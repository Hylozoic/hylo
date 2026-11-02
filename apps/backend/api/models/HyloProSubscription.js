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

  isActive,

  forGroup: function (groupId, opts = {}) {
    return this.query(q => {
      q.where('group_id', groupId)
      q.orderBy('created_at', 'desc')
      q.orderBy('id', 'desc')
    }).fetchAll(opts)
  },

  groupHasPro: async function (groupId, now = new Date()) {
    const rows = await this.forGroup(groupId)
    return rows.models.some(row => isActive(row, now))
  },

  /**
   * The row to show on the group's Billing page: an active Stripe subscription first, then any
   * active grant, then the most recent row (e.g. a lapsed subscription), or null.
   */
  currentForGroup: async function (groupId, now = new Date()) {
    const rows = (await this.forGroup(groupId)).models
    return rows.find(row => row.get('source') === SOURCE_STRIPE && isActive(row, now)) ||
      rows.find(row => isActive(row, now)) ||
      rows[0] ||
      null
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
