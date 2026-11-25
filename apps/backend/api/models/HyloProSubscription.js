/* eslint-disable camelcase */
/* global Group, User */

import {
  HYLO_PRO_DEFAULT_TIER,
  HYLO_PRO_TIERS,
  higherProTier,
  isProFeature,
  noProFeatures,
  resolveProFeatures
} from '@hylo/shared'

/**
 * A group's Hylo Pro entitlement: either a Stripe subscription on the Hylo platform account
 * (source 'stripe', kept in sync by webhooks — see HyloProService) or a manual grant by a
 * Hylo admin (source 'manual', optionally ending at expires_at).
 *
 * Each row gives a bundle of features: its `tier` ('pro', 'pro_plus' or 'custom', see the registry
 * in packages/shared HyloProFeatures.js) plus per-row overrides in `features`
 * (`{ "<featureKey>": true | false }` — true adds a feature outside the tier, false removes one).
 * A group's features are computed on read from its active rows (featuresForGroup): the union of
 * every active row's bundle. hasPro stays "any active row"; feature gates use
 * Group.hasProFeature(key) instead.
 */

const SOURCE_STRIPE = 'stripe'
const SOURCE_MANUAL = 'manual'

// Stripe statuses that mean the group is paid up (or in a trial)
const ACTIVE_STRIPE_STATUSES = ['active', 'trialing']
// Stripe statuses where the subscription still exists but isn't paid up: a failed or pending
// payment Stripe is still retrying (past_due, unpaid, incomplete), or a paused subscription.
// These don't give Pro (except past_due during its grace period, see isActive), but the group must
// manage that subscription rather than start another.
const OPEN_UNPAID_STRIPE_STATUSES = ['past_due', 'unpaid', 'incomplete', 'paused']
// Statuses where the customer has to act (pay or update the card) to keep the subscription
const NEEDS_PAYMENT_STRIPE_STATUSES = ['past_due', 'unpaid', 'incomplete']
// Stripe statuses a subscription can never leave
const TERMINAL_STRIPE_STATUSES = ['canceled', 'incomplete_expired']
// Stripe statuses of a subscription whose first payment never went through, so it never gave Pro
const NEVER_PAID_STRIPE_STATUSES = ['incomplete', 'incomplete_expired']
// Grace period for Stripe rows, used two ways:
// - a past_due subscription (its renewal payment failed; Stripe is retrying) keeps Pro this long
//   after the payment was first attempted (current_period_start, when the renewal was billed).
//   That is the 'grace' state (see proState).
// - a row this long past current_period_end means we missed the renewal or the deletion webhook;
//   it stops granting Pro instead of granting it forever. Stripe still says it is paid up, so
//   until then it counts as 'active', not 'grace'.
const STRIPE_GRACE_DAYS = 7
const STRIPE_GRACE_MS = STRIPE_GRACE_DAYS * 24 * 60 * 60 * 1000

/**
 * A group's Hylo Pro state. proState (below) is the one place it is decided, from all the group's
 * rows; hasPro, the Billing tab and the Pro feature gates all follow it.
 * - active: paid up, in a trial, or granted by Hylo. Every Pro feature works and monthly limits
 *   start afresh each month.
 * - grace: the renewal payment failed less than STRIPE_GRACE_DAYS ago and Stripe is retrying.
 *   Pro features keep working, but monthly limits don't start afresh until the group pays again,
 *   and stewards are asked to update their payment method.
 * - lapsed: the group had Pro and no longer does. What it made with Pro stays (a theme, designed
 *   views...), but it can't be changed with Pro features any more.
 * - none: the group never had Pro.
 */
const PRO_STATE_ACTIVE = 'active'
const PRO_STATE_GRACE = 'grace'
const PRO_STATE_LAPSED = 'lapsed'
const PRO_STATE_NONE = 'none'
const PRO_STATES = [PRO_STATE_ACTIVE, PRO_STATE_GRACE, PRO_STATE_LAPSED, PRO_STATE_NONE]
// States in which Pro features work (and hasPro is true)
const PRO_FEATURE_STATES = [PRO_STATE_ACTIVE, PRO_STATE_GRACE]
// States in which a monthly limit or allowance may start a new month. Not 'grace': usage keeps
// counting against the last paid month until the group pays again.
const LIMIT_REFRESH_STATES = [PRO_STATE_ACTIVE]

function toDate (value) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function attrsOf (row) {
  return typeof row.get === 'function' ? row.attributes : row
}

// A row's feature overrides as `{ [key]: boolean }` (the jsonb column may come back as an object
// or, from a raw insert, a string); keys that are no longer registered are dropped
function featureOverrides (row) {
  if (!row) return {}
  let value = attrsOf(row).features
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch (e) { value = null }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const overrides = {}
  for (const key of Object.keys(value)) {
    if (isProFeature(key) && typeof value[key] === 'boolean') overrides[key] = value[key]
  }
  return overrides
}

/**
 * The features a set of rows gives at `now`, as `{ [key]: boolean }` over every registered feature:
 * for each active row, its tier's features plus/minus its overrides; the union across rows.
 * Works on models or plain row objects.
 *
 * Follows the group's Pro state (proState): features work in 'active' and in 'grace' (a failed
 * payment within the grace period), and are all off in 'lapsed' and 'none'. Once Pro has lapsed,
 * what the group made with Pro stays, but gates using these features refuse to change it.
 */
function effectiveFeatures (rows, now = new Date()) {
  if (!stateHasPro(proState(rows, now))) return noProFeatures()
  const active = (rows || []).filter(row => isActive(row, now))
  return resolveProFeatures(active.map(row => ({
    tier: attrsOf(row).tier || HYLO_PRO_DEFAULT_TIER,
    features: featureOverrides(row)
  })))
}

// The highest tier among the rows active at `now`, or null when none is
function effectiveTier (rows, now = new Date()) {
  return (rows || [])
    .filter(row => isActive(row, now))
    .reduce((highest, row) => higherProTier(highest, attrsOf(row).tier || HYLO_PRO_DEFAULT_TIER), null)
}

/**
 * Whether a row grants Pro at `now`. Works on a model or a plain row object.
 *
 * - stripe: status active/trialing, or past_due for less than STRIPE_GRACE_DAYS since
 *   current_period_start; current_period_end set and less than STRIPE_GRACE_DAYS ago; and no
 *   scheduled cancellation (cancel_at, or cancel_at_period_end + current_period_end) or end that
 *   has already passed. A subscription canceled at period end stays 'active' in Stripe
 *   until the period is over, so it keeps Pro until then. The period checks cover a missed
 *   customer.subscription.deleted (or a missed renewal, which re-syncs on the next Checkout attempt).
 * - manual: status active and expires_at unset or in the future.
 */
function isActive (row, now = new Date()) {
  if (!row) return false
  const attrs = attrsOf(row)
  const nowTime = toDate(now).getTime()
  const passed = value => {
    const date = toDate(value)
    return !!date && date.getTime() <= nowTime
  }

  if (attrs.source === SOURCE_MANUAL) {
    return attrs.status === 'active' && !passed(attrs.expires_at)
  }

  const withinGrace = value => {
    const date = toDate(value)
    return !!date && date.getTime() + STRIPE_GRACE_MS > nowTime
  }

  const pastDueInGrace = attrs.status === 'past_due' && withinGrace(attrs.current_period_start)
  if (!ACTIVE_STRIPE_STATUSES.includes(attrs.status) && !pastDueInGrace) return false
  if (passed(attrs.ended_at)) return false
  if (passed(attrs.cancel_at)) return false
  if (attrs.cancel_at_period_end && passed(attrs.current_period_end)) return false
  return withinGrace(attrs.current_period_end)
}

// Whether a row gives Pro at `now` only because of the past_due grace period ('grace', see proState)
function isInGrace (row, now = new Date()) {
  if (!row) return false
  const attrs = attrsOf(row)
  return attrs.source === SOURCE_STRIPE && attrs.status === 'past_due' && isActive(attrs, now)
}

// When a row's grace period ends (Pro stops unless the group pays), or null when it isn't in grace
function graceEndsAt (row, now = new Date()) {
  if (!isInGrace(row, now)) return null
  return new Date(toDate(attrsOf(row).current_period_start).getTime() + STRIPE_GRACE_MS)
}

// Whether a row ever gave the group Pro: any grant, and any subscription whose first payment went through
function everGavePro (row) {
  if (!row) return false
  const attrs = attrsOf(row)
  if (attrs.source === SOURCE_MANUAL) return true
  return !NEVER_PAID_STRIPE_STATUSES.includes(attrs.status)
}

/**
 * A group's Pro state at `now` from all of its rows (models or plain objects): 'active' if any row
 * gives Pro outright (so a grant covers a failed payment), else 'grace' if a past_due subscription
 * is in its grace period, else 'lapsed' if any row ever gave Pro, else 'none'. See PRO_STATES.
 */
function proState (rows, now = new Date()) {
  const list = rows || []
  const giving = list.filter(row => isActive(row, now))
  if (giving.some(row => !isInGrace(row, now))) return PRO_STATE_ACTIVE
  if (giving.length > 0) return PRO_STATE_GRACE
  if (list.some(everGavePro)) return PRO_STATE_LAPSED
  return PRO_STATE_NONE
}

// Whether Pro features work in a state ('active' or 'grace')
function stateHasPro (state) {
  return PRO_FEATURE_STATES.includes(state)
}

// Whether monthly limits and allowances may start a new month in a state (only 'active')
function stateRefreshesLimits (state) {
  return LIMIT_REFRESH_STATES.includes(state)
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
  const graceStart = new Date(toDate(now).getTime() - STRIPE_GRACE_MS)
  q.where(function () {
    this.where(function () {
      this.where('source', SOURCE_MANUAL)
        .where('status', 'active')
        .where(q2 => q2.whereNull('expires_at').orWhere('expires_at', '>', now))
    }).orWhere(function () {
      this.where('source', SOURCE_STRIPE)
        .where(q2 => q2.whereIn('status', ACTIVE_STRIPE_STATUSES)
          .orWhere(q3 => q3.where('status', 'past_due').where('current_period_start', '>', graceStart)))
        .where(q2 => q2.whereNull('ended_at').orWhere('ended_at', '>', now))
        .where(q2 => q2.whereNull('cancel_at').orWhere('cancel_at', '>', now))
        .where('current_period_end', '>', graceStart)
        .where(q2 => q2.where('cancel_at_period_end', false).orWhere('current_period_end', '>', now))
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

  isInGrace: function (now = new Date()) {
    return isInGrace(this, now)
  },

  graceEndsAt: function (now = new Date()) {
    return graceEndsAt(this, now)
  },

  // 'pro', 'pro_plus' or 'custom'
  tier: function () {
    return this.get('tier') || HYLO_PRO_DEFAULT_TIER
  },

  // This row's overrides of its tier bundle, `{ [key]: boolean }` (empty when none)
  featureOverrides: function () {
    return featureOverrides(this)
  },

  // Every registered feature this row gives (its tier plus overrides), as `{ [key]: boolean }`, ignoring whether it is active
  features: function () {
    return resolveProFeatures([{ tier: this.tier(), features: this.featureOverrides() }])
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
  TIERS: HYLO_PRO_TIERS,
  DEFAULT_TIER: HYLO_PRO_DEFAULT_TIER,
  ACTIVE_STRIPE_STATUSES,
  OPEN_UNPAID_STRIPE_STATUSES,
  NEEDS_PAYMENT_STRIPE_STATUSES,
  TERMINAL_STRIPE_STATUSES,
  NEVER_PAID_STRIPE_STATUSES,
  STRIPE_GRACE_DAYS,
  PRO_STATE_ACTIVE,
  PRO_STATE_GRACE,
  PRO_STATE_LAPSED,
  PRO_STATE_NONE,
  PRO_STATES,
  PRO_FEATURE_STATES,
  LIMIT_REFRESH_STATES,

  isActive,
  isInGrace,
  graceEndsAt,
  everGavePro,
  proState,
  stateHasPro,
  stateRefreshesLimits,
  isOpenStripeSubscription,
  whereActive,
  effectiveFeatures,
  effectiveTier,
  featureOverrides,

  forGroup: function (groupId, opts = {}) {
    return this.query(q => {
      q.where('group_id', groupId)
      q.orderBy('created_at', 'desc')
      q.orderBy('id', 'desc')
    }).fetchAll(opts)
  },

  // The group's Pro state at `now` (see proState)
  groupProState: async function (groupId, now = new Date()) {
    const rows = await bookshelf.knex('hylo_pro_subscriptions')
      .where('group_id', groupId)
      .select('source', 'status', 'expires_at', 'current_period_start', 'current_period_end',
        'cancel_at_period_end', 'cancel_at', 'ended_at')
    return proState(rows, now)
  },

  // Whether the group has Pro at `now`: its state is 'active' or 'grace'. Decided in SQL (whereActive)
  groupHasPro: async function (groupId, now = new Date()) {
    const row = await bookshelf.knex('hylo_pro_subscriptions')
      .where('group_id', groupId)
      .modify(q => whereActive(q, now))
      .first('id')
    return !!row
  },

  /**
   * The Pro features a group has now, `{ [key]: boolean }` over every registered feature: every
   * feature of each active row's tier plus its overrides. All false for a group without Pro.
   */
  featuresForGroup: async function (groupId, now = new Date()) {
    // Only rows giving Pro can give features, so the others needn't be read (see effectiveFeatures)
    const rows = await bookshelf.knex('hylo_pro_subscriptions')
      .where('group_id', groupId)
      .modify(q => whereActive(q, now))
      .select('source', 'status', 'tier', 'features', 'expires_at', 'current_period_start', 'current_period_end',
        'cancel_at_period_end', 'cancel_at', 'ended_at')
    return effectiveFeatures(rows, now)
  },

  /**
   * What the group's Billing page shows:
   * - subscription: the group's Stripe subscription — an open one (active, or unpaid/paused) first,
   *   else the most recent one (e.g. lapsed), or null. Shown even while a manual grant is active,
   *   so stewards can still see a failed payment and manage the subscription.
   * - grant: an active manual grant, or null
   * - hasPro: whether any row gives the group Pro
   * - tier: the highest tier among the rows giving Pro, or null without Pro
   * - features: `{ [key]: boolean }` over every registered feature (see featuresForGroup)
   * - state: the group's Pro state (see proState)
   * - graceEndsAt: in 'grace', when Pro stops unless the group pays; otherwise null
   */
  billingForGroup: async function (groupId, now = new Date()) {
    const rows = (await this.forGroup(groupId)).models
    const stripeRows = rows.filter(row => row.get('source') === SOURCE_STRIPE)
    const subscription = stripeRows.find(row => isActive(row, now)) ||
      stripeRows.find(row => isOpenStripeSubscription(row, now)) ||
      stripeRows[0] ||
      null
    const grant = rows.find(row => row.get('source') === SOURCE_MANUAL && isActive(row, now)) || null
    const state = proState(rows, now)
    return {
      subscription,
      grant,
      hasPro: stateHasPro(state),
      state,
      graceEndsAt: state === PRO_STATE_GRACE ? graceEndsAt(subscription, now) : null,
      tier: effectiveTier(rows, now),
      features: effectiveFeatures(rows, now)
    }
  }
})
