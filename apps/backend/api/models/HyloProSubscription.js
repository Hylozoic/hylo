/* eslint-disable camelcase */
/* global Group, User */

/**
 * A group's Hylo Pro entitlement: either a Stripe subscription on the Hylo platform account
 * (source 'stripe', kept in sync by webhooks — see HyloProService) or a manual grant by a
 * Hylo admin (source 'manual', optionally ending at expires_at).
 */

const SOURCE_STRIPE = 'stripe'
const SOURCE_MANUAL = 'manual'

// Stripe statuses that mean the group is paid up (or in a trial)
const ACTIVE_STRIPE_STATUSES = ['active', 'trialing']
// Stripe statuses where the subscription still exists but isn't paid up: a failed or pending
// payment Stripe is still retrying (past_due, unpaid, incomplete), or a paused subscription.
// These don't give Pro, but the group must manage that subscription rather than start another.
const OPEN_UNPAID_STRIPE_STATUSES = ['past_due', 'unpaid', 'incomplete', 'paused']
// Statuses where the customer has to act (pay or update the card) to keep the subscription
const NEEDS_PAYMENT_STRIPE_STATUSES = ['past_due', 'unpaid', 'incomplete']
// Stripe statuses a subscription can never leave
const TERMINAL_STRIPE_STATUSES = ['canceled', 'incomplete_expired']

function toDate (value) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

/**
 * Whether a row grants Pro at `now`. Works on a model or a plain row object.
 *
 * - stripe: status active/trialing, unless a scheduled cancellation (cancel_at, or
 *   cancel_at_period_end + current_period_end) has already passed, or the subscription ended.
 *   A subscription canceled at period end stays 'active' in Stripe until the period is over,
 *   so it keeps Pro until then; the period-end check covers a missed customer.subscription.deleted.
 * - manual: status active and expires_at unset or in the future.
 */
function isActive (row, now = new Date()) {
  if (!row) return false
  const attrs = typeof row.get === 'function' ? row.attributes : row
  const nowTime = toDate(now).getTime()
  const passed = value => {
    const date = toDate(value)
    return !!date && date.getTime() <= nowTime
  }

  if (attrs.source === SOURCE_MANUAL) {
    return attrs.status === 'active' && !passed(attrs.expires_at)
  }

  if (!ACTIVE_STRIPE_STATUSES.includes(attrs.status)) return false
  if (passed(attrs.ended_at)) return false
  if (passed(attrs.cancel_at)) return false
  if (attrs.cancel_at_period_end && passed(attrs.current_period_end)) return false
  return true
}

/**
 * Whether a Stripe row is a subscription that still exists in Stripe: active (see isActive) or
 * open but unpaid/paused. The group can't start another subscription while one is open.
 */
function isOpenStripeSubscription (row, now = new Date()) {
  if (!row) return false
  const attrs = typeof row.get === 'function' ? row.attributes : row
  if (attrs.source !== SOURCE_STRIPE) return false
  if (isActive(attrs, now)) return true
  if (attrs.ended_at && toDate(attrs.ended_at).getTime() <= toDate(now).getTime()) return false
  return OPEN_UNPAID_STRIPE_STATUSES.includes(attrs.status)
}

/**
 * Restricts a knex query to rows that grant Pro at `now` — the SQL version of isActive.
 */
function whereActive (q, now = new Date()) {
  q.where(function () {
    this.where(function () {
      this.where('source', SOURCE_MANUAL)
        .where('status', 'active')
        .where(q2 => q2.whereNull('expires_at').orWhere('expires_at', '>', now))
    }).orWhere(function () {
      this.where('source', SOURCE_STRIPE)
        .whereIn('status', ACTIVE_STRIPE_STATUSES)
        .where(q2 => q2.whereNull('ended_at').orWhere('ended_at', '>', now))
        .where(q2 => q2.whereNull('cancel_at').orWhere('cancel_at', '>', now))
        .where(q2 => q2.where('cancel_at_period_end', false)
          .orWhereNull('current_period_end')
          .orWhere('current_period_end', '>', now))
    })
  })
  return q
}

module.exports = bookshelf.Model.extend({
  tableName: 'hylo_pro_subscriptions',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  grantedBy: function () {
    return this.belongsTo(User, 'granted_by_id')
  },

  isActive: function (now = new Date()) {
    return isActive(this, now)
  },

  // When Pro access stops if nothing changes: a scheduled cancellation, the end of a manual grant, or null if it renews
  endsAt: function () {
    if (this.get('source') === SOURCE_MANUAL) return this.get('expires_at') || null
    if (this.get('cancel_at')) return this.get('cancel_at')
    if (this.get('cancel_at_period_end')) return this.get('current_period_end')
    return null
  }
}, {
  SOURCE_STRIPE,
  SOURCE_MANUAL,
  ACTIVE_STRIPE_STATUSES,
  OPEN_UNPAID_STRIPE_STATUSES,
  NEEDS_PAYMENT_STRIPE_STATUSES,
  TERMINAL_STRIPE_STATUSES,

  isActive,
  isOpenStripeSubscription,
  whereActive,

  forGroup: function (groupId, opts = {}) {
    return this.query(q => {
      q.where('group_id', groupId)
      q.orderBy('created_at', 'desc')
      q.orderBy('id', 'desc')
    }).fetchAll(opts)
  },

  groupHasPro: async function (groupId, now = new Date()) {
    const row = await bookshelf.knex('hylo_pro_subscriptions')
      .where('group_id', groupId)
      .modify(q => whereActive(q, now))
      .first('id')
    return !!row
  },

  /**
   * What the group's Billing page shows:
   * - subscription: the group's Stripe subscription — an open one (active, or unpaid/paused) first,
   *   else the most recent one (e.g. lapsed), or null. Shown even while a manual grant is active,
   *   so stewards can still see a failed payment and manage the subscription.
   * - grant: an active manual grant, or null
   * - hasPro: whether any row gives the group Pro
   */
  billingForGroup: async function (groupId, now = new Date()) {
    const rows = (await this.forGroup(groupId)).models
    const stripeRows = rows.filter(row => row.get('source') === SOURCE_STRIPE)
    const subscription = stripeRows.find(row => isActive(row, now)) ||
      stripeRows.find(row => isOpenStripeSubscription(row, now)) ||
      stripeRows[0] ||
      null
    const grant = rows.find(row => row.get('source') === SOURCE_MANUAL && isActive(row, now)) || null
    return { subscription, grant, hasPro: rows.some(row => isActive(row, now)) }
  },

  // The platform-account customer this group paid with before, so a re-subscription reuses it
  latestStripeCustomerId: async function (groupId) {
    const row = await this.query(q => {
      q.where('group_id', groupId)
      q.where('source', SOURCE_STRIPE)
      q.whereNotNull('stripe_customer_id')
      q.orderBy('created_at', 'desc')
      q.orderBy('id', 'desc')
    }).fetch()
    return row ? row.get('stripe_customer_id') : null
  }
})
