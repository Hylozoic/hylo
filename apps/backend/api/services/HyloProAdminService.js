/**
 * HyloProAdminService: Hylo staff tools for Hylo Pro, used by the /management Hylo Pro page.
 *
 * - metrics: counts and recurring revenue derived from hylo_pro_subscriptions.
 * - Manual grants (source 'manual'): grant Pro outside of payments, change a grant's end date or
 *   note, revoke it. Recorded with granted_by_id.
 * - Stripe subscriptions (source 'stripe', on the PLATFORM account — never pass stripeAccount):
 *   cancel at period end or now, undo a scheduled cancellation, extend, list and refund payments.
 *   Each change is made in Stripe and the row is then re-synced through
 *   HyloProService.syncSubscriptionById, so Stripe stays authoritative for those rows.
 *
 * Callers must check that the user is Hylo staff (Admin.isSuperAdmin); see graphql/mutations/hyloProAdmin.
 */

const Stripe = require('stripe')
const { GraphQLError } = require('graphql')
const { HYLO_PRO_DEFAULT_TIER, HYLO_PRO_TIERS, isProFeature, proFeatureOverrides, featuresForTier } = require('@hylo/shared')
const HyloProService = require('./HyloProService')

/* global bookshelf, Group, HyloProSubscription */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover'
})

const DAY_SECONDS = 24 * 60 * 60
const DAY_MS = DAY_SECONDS * 1000
// How far back the monthly new/cancelled series goes, including the current month
const METRICS_MONTHS = 6
// Grants ending within this many days are counted as "expiring soon"
const EXPIRING_SOON_DAYS = 30
// Longest single extension of a Stripe subscription, so a typo can't give years away
const MAX_EXTEND_DAYS = 366
// Stripe refuses a trial_end more than 730 days from now, on create and on update ("The maximum
// number of trial period days is 730 (2 years)"), so extensions in total can't go past that
const STRIPE_MAX_TRIAL_DAYS = 730
// Kept clear of Stripe's limit so a small clock difference doesn't turn into a Stripe error
const TRIAL_LIMIT_MARGIN_SECONDS = 60 * 60
const EXTEND_LIMIT = 'HYLO_PRO_EXTEND_LIMIT'
const MAX_NOTE_LENGTH = 1000
const PAGE_SIZE = 50
const PAYMENTS_PAGE_SIZE = 20

const LIST_FILTERS = ['active', 'past_due', 'manual', 'stripe', 'all']

function toDate (value) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function cleanNote (note) {
  const cleaned = (note || '').trim().slice(0, MAX_NOTE_LENGTH)
  return cleaned || null
}

// Returns a Date for a future expiry, null for "no end date", or throws for a bad or past date
function parseExpiresAt (expiresAt, now = new Date()) {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return null
  const date = toDate(expiresAt)
  if (isNaN(date.getTime())) throw new GraphQLError('expiresAt is not a valid date')
  if (date.getTime() <= now.getTime()) throw new GraphQLError('expiresAt must be in the future')
  return date
}

// A grant's tier as given to the API: one of HYLO_PRO_TIERS, defaulting to Pro
function parseTier (tier) {
  if (tier === null || tier === undefined || tier === '') return HYLO_PRO_DEFAULT_TIER
  if (!HYLO_PRO_TIERS.includes(tier)) throw new GraphQLError(`tier must be one of: ${HYLO_PRO_TIERS.join(', ')}`)
  return tier
}

/**
 * Feature overrides as given to the API — a list of `{ key, enabled }` — as the `{ [key]: boolean }`
 * stored on the row, keeping only differences from `tier` (an override that matches the tier is
 * dropped). Null when nothing differs. Every key must be a registered feature.
 */
function parseFeatureOverrides (features, tier) {
  if (features === null || features === undefined) return null
  if (!Array.isArray(features)) throw new GraphQLError('features must be a list of { key, enabled }')
  const chosen = new Set(featuresForTier(tier))
  for (const override of features) {
    const key = override?.key
    if (!isProFeature(key)) throw new GraphQLError(`Unknown Hylo Pro feature: ${key}`)
    if (typeof override.enabled !== 'boolean') throw new GraphQLError(`enabled must be true or false for feature ${key}`)
    if (override.enabled) chosen.add(key)
    else chosen.delete(key)
  }
  return proFeatureOverrides(tier, [...chosen])
}

// The jsonb value to store for overrides: JSON text (Postgres casts it), or null for none
function featuresColumn (overrides) {
  return overrides ? JSON.stringify(overrides) : null
}

function monthKey (date) {
  return date.toISOString().slice(0, 7) // YYYY-MM (UTC)
}

/**
 * Monthly recurring revenue in cents at today's plan price for `interval` (HyloProService.PLANS), a
 * yearly plan as 1/12. Only the fallback for Stripe rows synced before amounts were stored (see
 * monthlyRevenue); the daily re-sync fills those in.
 */
function monthlyAmount (interval) {
  const plan = HyloProService.PLANS[interval]
  if (!plan) return 0
  return interval === 'year' ? Math.round(plan.unitAmount / 12) : plan.unitAmount
}

// Billing periods of one `interval` per month, to turn a period's price into a monthly one
const PERIODS_PER_MONTH = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 }

/**
 * Whether a Stripe row's stored discount lowers what it pays from now on. A 'once' discount only
 * applied to the first invoice, so it isn't recurring revenue lost; a 'repeating' one stops at
 * discount_ends_at; 'forever' always applies.
 */
function discountApplies (attrs, now) {
  if (!attrs.discount_coupon_id) return false
  if (attrs.discount_duration === 'once') return false
  const endsAt = toDate(attrs.discount_ends_at)
  return !endsAt || endsAt.getTime() > toDate(now).getTime()
}

/**
 * What a Stripe row pays per month, from what was stored at its last sync (amount, currency,
 * interval, interval_count and discount): `{ cents, currency, estimated }`. cents is unrounded so
 * a total of many rows rounds once. A percent-off discount reduces the price by that percent; an
 * amount-off one by that amount per billing period (only when it's in the price's currency, as
 * Stripe requires). The result is normalised to a month: a yearly price counts 1/12, a weekly one
 * 52/12. A row synced before amounts were stored has no amount: it's counted at today's plan
 * price for its interval, in the plan currency, with estimated true.
 */
function monthlyRevenue (row, now = new Date()) {
  const attrs = typeof row.get === 'function' ? row.attributes : row
  if (attrs.amount === null || attrs.amount === undefined) {
    return { cents: monthlyAmount(attrs.interval), currency: HyloProService.CURRENCY, estimated: true }
  }
  const currency = (attrs.currency || HyloProService.CURRENCY).toLowerCase()
  let perPeriod = Number(attrs.amount)
  if (discountApplies(attrs, now)) {
    if (attrs.discount_percent_off !== null && attrs.discount_percent_off !== undefined) {
      perPeriod = perPeriod * (1 - Number(attrs.discount_percent_off) / 100)
    } else if (attrs.discount_amount_off !== null && attrs.discount_amount_off !== undefined &&
      (attrs.discount_currency || '').toLowerCase() === currency) {
      perPeriod = perPeriod - Number(attrs.discount_amount_off)
    }
  }
  const perMonth = PERIODS_PER_MONTH[attrs.interval]
  if (!perMonth) return { cents: 0, currency, estimated: false }
  const count = Number(attrs.interval_count) || 1
  return { cents: Math.max(perPeriod, 0) * perMonth / count, currency, estimated: false }
}

/**
 * MRR of paying Stripe rows, per currency: `[{ currency, mrrCents, subscriptions }]`, the plan
 * currency first, then by currency code. Amounts in different currencies are never converted or
 * added together (there's no exchange rate to use that wouldn't be out of date); each currency gets
 * its own total. `estimated` counts rows valued at today's plan price (see monthlyRevenue).
 */
function revenueByCurrency (rows, now = new Date()) {
  const totals = new Map()
  let estimated = 0
  for (const row of rows) {
    const { cents, currency, estimated: isEstimate } = monthlyRevenue(row, now)
    if (isEstimate) estimated++
    const total = totals.get(currency) || { currency, cents: 0, subscriptions: 0 }
    total.cents += cents
    total.subscriptions++
    totals.set(currency, total)
  }
  const planCurrency = HyloProService.CURRENCY
  const byCurrency = [...totals.values()]
    .map(({ currency, cents, subscriptions }) => ({ currency, mrrCents: Math.round(cents), subscriptions }))
    .sort((a, b) => (b.currency === planCurrency) - (a.currency === planCurrency) || a.currency.localeCompare(b.currency))
  return { byCurrency, estimated }
}

// Dispute statuses that are final (https://docs.stripe.com/api/disputes/object): any other status
// is a dispute or inquiry still waiting for an outcome
const CLOSED_DISPUTE_STATUSES = ['won', 'lost', 'warning_closed', 'prevented']
const CHARGE_EVENTS_LIMIT = 100

const MAX_BIGINT = BigInt('9223372036854775807')

// An all-digit string as a group id in canonical form ('007' -> '7'), or null when it isn't one
// or is too big for a bigint id (which would be a database error rather than "not found")
function canonicalId (value) {
  if (!/^\d+$/.test(value)) return null
  const id = BigInt(value)
  return id > MAX_BIGINT ? null : id.toString()
}

// A group id as given to the API, which must be numeric (never a slug), or throws
function groupIdOf (groupId) {
  const id = canonicalId(String(groupId ?? '').trim())
  if (!id) throw new GraphQLError('Group not found')
  return id
}

async function findGroupById (groupId) {
  const group = await Group.where({ id: groupIdOf(groupId) }).fetch()
  if (!group || !group.get('active')) throw new GraphQLError('Group not found')
  return group
}

async function findRow (id, { transacting, source } = {}) {
  const rowId = canonicalId(String(id ?? '').trim())
  const row = rowId && await HyloProSubscription.where({ id: rowId }).fetch({ transacting })
  if (!row) throw new GraphQLError('Hylo Pro subscription or grant not found')
  if (source && row.get('source') !== source) {
    throw new GraphQLError(source === HyloProSubscription.SOURCE_MANUAL
      ? 'This is not a manual grant'
      : 'This is not a Stripe subscription')
  }
  return row
}

async function findStripeRow (id) {
  const row = await findRow(id, { source: HyloProSubscription.SOURCE_STRIPE })
  if (!row.get('stripe_subscription_id')) throw new GraphQLError('This row has no Stripe subscription')
  return row
}

function assertNotEnded (row) {
  if (HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(row.get('status'))) {
    throw new GraphQLError('This subscription has already ended')
  }
}

// Re-reads the subscription from Stripe and saves it (the same path webhooks use)
async function resync (row) {
  const synced = await HyloProService.syncSubscriptionById(row.get('stripe_subscription_id'))
  // syncSubscription skips subscriptions that aren't this group's customer's; fall back to a fresh read of our row
  return synced || HyloProSubscription.where({ id: row.id }).fetch()
}

// Dispute statuses (https://docs.stripe.com/api/disputes/object) that still allow a refund:
// inquiries (warning_*, not chargebacks), disputes we won, and disputes prevented from becoming a
// chargeback. While a chargeback is open (needs_response, under_review, appeal_*) Stripe settles
// it through the dispute, and after a lost one the money has already gone back to the customer.
// Unknown statuses are treated as open, so nothing is refunded twice.
const REFUNDABLE_DISPUTE_STATUSES = ['warning_needs_response', 'warning_under_review', 'warning_closed', 'won', 'prevented']

/**
 * Why a charge's dispute stops it being refunded: 'dispute_open', 'dispute_lost', or null when it
 * doesn't (no dispute, or one in REFUNDABLE_DISPUTE_STATUSES). A disputed charge whose dispute
 * couldn't be read counts as open.
 */
function disputeRefundBlock (charge, dispute) {
  if (!charge.disputed) return null
  const status = dispute?.status
  if (status === 'lost') return 'dispute_lost'
  return REFUNDABLE_DISPUTE_STATUSES.includes(status) ? null : 'dispute_open'
}

/**
 * The id of the Stripe subscription a charge paid for (charge -> invoice payment -> invoice ->
 * subscription), or null if it wasn't a subscription invoice payment or the lookup failed. Since
 * API 2025-03-31.basil charges have no `invoice` field; the link is the InvoicePayment, and the
 * invoice's subscription is under parent.subscription_details. stripe-node 17 has no
 * invoicePayments resource, hence rawRequest.
 */
async function chargeSubscriptionId (charge) {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  const payment = paymentIntent
    ? `payment[type]=payment_intent&payment[payment_intent]=${encodeURIComponent(paymentIntent)}`
    : `payment[type]=charge&payment[charge]=${encodeURIComponent(charge.id)}`
  try {
    const result = await stripe.rawRequest('GET', `/v1/invoice_payments?${payment}&expand[]=data.invoice&limit=10`, null)
    for (const invoicePayment of result?.data || []) {
      const subscription = invoicePayment.invoice?.parent?.subscription_details?.subscription
      if (subscription) return typeof subscription === 'string' ? subscription : subscription.id
    }
    return null
  } catch (error) {
    console.error(`Hylo Pro: couldn't find the subscription for charge ${charge.id}:`, error.message)
    return null
  }
}

// The most recent dispute on a disputed charge, or null if it can't be read
async function latestDispute (chargeId) {
  try {
    const disputes = await stripe.disputes.list({ charge: chargeId, limit: 1 })
    return disputes.data[0] || null
  } catch (error) {
    console.error(`Hylo Pro: couldn't read the dispute on charge ${chargeId}:`, error.message)
    return null
  }
}

// Grant changes for one group run one at a time, so a group never ends up with two active grants
function withGrantLock (groupId, fn) {
  return HyloProService.withLock(`hylo_pro_grant:${groupId}`, fn)
}

module.exports = {
  METRICS_MONTHS,
  EXPIRING_SOON_DAYS,
  MAX_EXTEND_DAYS,
  STRIPE_MAX_TRIAL_DAYS,
  EXTEND_LIMIT,
  LIST_FILTERS,
  CLOSED_DISPUTE_STATUSES,
  monthlyAmount,
  monthlyRevenue,
  revenueByCurrency,

  /**
   * Hylo Pro numbers for the management page, all derived from hylo_pro_subscriptions.
   * "Active" uses the same rules as Group.hasPro (HyloProSubscription.whereActive). Paid
   * subscriptions and recurring revenue count the same rows: active and past_due (still in grace)
   * Stripe subscriptions, each at what it pays as of its last sync, discounts included (see
   * monthlyRevenue), normalised to a month. Revenue is totalled per currency (mrrByCurrency);
   * mrrCents is the plan currency's total. Trialing subscriptions (e.g. extended ones) pay nothing
   * now and are counted separately.
   */
  async metrics (now = new Date()) {
    const knex = bookshelf.knex
    const stripeSource = HyloProSubscription.SOURCE_STRIPE
    const manualSource = HyloProSubscription.SOURCE_MANUAL
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS)
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (METRICS_MONTHS - 1), 1))

    const [[active], [{ count: pastDue }], eventCounts, payingRows] = await Promise.all([
      knex('hylo_pro_subscriptions')
        .modify(q => HyloProSubscription.whereActive(q, now))
        .select(knex.raw(`
          count(distinct group_id) as active_groups,
          count(distinct group_id) filter (where source = :stripeSource) as stripe_groups,
          count(distinct group_id) filter (where source = :manualSource) as manual_groups,
          count(*) filter (where source = :stripeSource and status <> 'trialing' and interval = 'month') as paying_monthly,
          count(*) filter (where source = :stripeSource and status <> 'trialing' and interval = 'year') as paying_yearly,
          count(*) filter (where source = :stripeSource and status = 'trialing') as trialing,
          count(*) filter (where source = :stripeSource and (cancel_at_period_end or cancel_at is not null)) as cancelling,
          count(*) filter (where source = :manualSource and expires_at <= :soon) as expiring_soon
        `, { stripeSource, manualSource, soon })),
      knex('hylo_pro_subscriptions')
        .where({ source: stripeSource, status: 'past_due' })
        .whereNull('ended_at')
        .count(),
      // Per month (UTC): Stripe subscriptions started, cancellations requested, subscriptions ended, grants made
      knex.raw(`
        select month, field, count(*) as count from (
          select to_char(created_at at time zone 'UTC', 'YYYY-MM') as month,
            case when source = :stripeSource then 'newSubscriptions' else 'grants' end as field
            from hylo_pro_subscriptions where created_at >= :firstMonth
          union all
          select to_char(canceled_at at time zone 'UTC', 'YYYY-MM'), 'cancellations'
            from hylo_pro_subscriptions where source = :stripeSource and canceled_at >= :firstMonth
          union all
          select to_char(ended_at at time zone 'UTC', 'YYYY-MM'), 'ended'
            from hylo_pro_subscriptions where source = :stripeSource and ended_at >= :firstMonth
        ) events
        group by month, field
      `, { stripeSource, firstMonth }),
      // The rows MRR counts, with what each pays
      knex('hylo_pro_subscriptions')
        .modify(q => HyloProSubscription.whereActive(q, now))
        .where('source', stripeSource)
        .whereNot('status', 'trialing')
        .select('interval', 'amount', 'currency', 'interval_count', 'discount_coupon_id', 'discount_percent_off',
          'discount_amount_off', 'discount_currency', 'discount_duration', 'discount_ends_at')
    ])

    // Months from oldest to current, UTC
    const months = []
    for (let i = METRICS_MONTHS - 1; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      months.push({ month: monthKey(date), newSubscriptions: 0, cancellations: 0, ended: 0, grants: 0 })
    }
    const byMonth = Object.fromEntries(months.map(m => [m.month, m]))
    for (const { month, field, count } of eventCounts.rows) {
      if (byMonth[month]) byMonth[month][field] = Number(count)
    }

    const payingMonthly = Number(active.paying_monthly)
    const payingYearly = Number(active.paying_yearly)
    const revenue = revenueByCurrency(payingRows, now)
    const planRevenue = revenue.byCurrency.find(r => r.currency === HyloProService.CURRENCY)
    return {
      activeGroups: Number(active.active_groups),
      stripeGroups: Number(active.stripe_groups),
      manualGroups: Number(active.manual_groups),
      monthlySubscriptions: payingMonthly,
      yearlySubscriptions: payingYearly,
      trialing: Number(active.trialing),
      cancelling: Number(active.cancelling),
      pastDue: Number(pastDue),
      grantsExpiringSoon: Number(active.expiring_soon),
      mrrCents: planRevenue ? planRevenue.mrrCents : 0,
      currency: HyloProService.CURRENCY,
      mrrByCurrency: revenue.byCurrency,
      mrrEstimatedSubscriptions: revenue.estimated,
      months
    }
  },

  /**
   * Subscription and grant rows with their group, newest first.
   *
   * @param {string} filter one of LIST_FILTERS: 'active' (gives Pro now), 'past_due', 'manual', 'stripe' or 'all'
   * @param {string} search matches group name or slug
   * @returns {Promise<{ items: HyloProSubscription[], total: number, hasMore: boolean }>}
   */
  async listSubscriptions ({ filter = 'active', search, first = PAGE_SIZE, offset = 0 } = {}, now = new Date()) {
    if (!LIST_FILTERS.includes(filter)) throw new GraphQLError(`filter must be one of: ${LIST_FILTERS.join(', ')}`)
    const limit = Math.min(Math.max(Number(first) || PAGE_SIZE, 1), 200)
    const skip = Math.max(Number(offset) || 0, 0)

    const scope = q => {
      if (filter === 'active') HyloProSubscription.whereActive(q, now)
      if (filter === 'past_due') q.where('status', 'past_due').whereNull('ended_at')
      if (filter === 'manual') q.where('source', HyloProSubscription.SOURCE_MANUAL)
      if (filter === 'stripe') q.where('source', HyloProSubscription.SOURCE_STRIPE)
      const term = (search || '').trim()
      if (term) {
        const like = `%${term.replace(/[\\%_]/g, c => '\\' + c)}%`
        q.whereIn('group_id', bookshelf.knex('groups').select('id').where(q2 => q2.where('name', 'ilike', like).orWhere('slug', 'ilike', like)))
      }
    }

    const [[{ count }], items] = await Promise.all([
      bookshelf.knex('hylo_pro_subscriptions').modify(scope).count(),
      HyloProSubscription.query(q => {
        scope(q)
        q.orderBy('created_at', 'desc')
        q.orderBy('id', 'desc')
        q.limit(limit)
        q.offset(skip)
      }).fetchAll({ withRelated: ['group', 'grantedBy'] })
    ])

    const total = Number(count)
    return { items: items.models, total, hasMore: skip + items.length < total }
  },

  /**
   * Groups matching what staff typed in the grant form: the group with that slug and, when the
   * value is all digits, the group with that id. Both are returned when they differ (a group's
   * slug can be all digits), so staff pick the one they mean before granting by id.
   */
  async findGroups (slugOrId) {
    const value = String(slugOrId || '').trim()
    if (!value) return []
    const [bySlug, byId] = await Promise.all([
      Group.where({ slug: value, active: true }).fetch(),
      canonicalId(value) ? Group.where({ id: canonicalId(value), active: true }).fetch() : null
    ])
    if (bySlug && byId && bySlug.id === byId.id) return [bySlug]
    return [bySlug, byId].filter(Boolean)
  },

  /**
   * Grants a group Pro outside of payments. Refused while the group already has an active grant
   * (change that grant's end date instead), so a group never has two grants to keep track of.
   *
   * @param {string} groupId the group's id; never a slug (see findGroups)
   * @param {string} [tier] 'pro' (default), 'pro_plus' or 'custom': the bundle of features granted
   * @param {Array<{ key: string, enabled: boolean }>} [features] single features to add to or remove from the bundle
   */
  async grant ({ adminId, groupId, tier, features, expiresAt, note }, now = new Date()) {
    const group = await findGroupById(groupId)
    if (group.get('type') === 'space') throw new GraphQLError('Hylo Pro is only available for groups, not spaces')
    const expires = parseExpiresAt(expiresAt, now)
    const grantTier = parseTier(tier)
    const overrides = parseFeatureOverrides(features, grantTier)

    const id = await withGrantLock(group.id, async trx => {
      const existing = await trx('hylo_pro_subscriptions')
        .where({ group_id: group.id, source: HyloProSubscription.SOURCE_MANUAL })
        .modify(q => HyloProSubscription.whereActive(q, now))
        .first('id')
      if (existing) throw new GraphQLError('This group already has an active Hylo Pro grant. Change its end date instead.')

      const [row] = await trx('hylo_pro_subscriptions').insert({
        group_id: group.id,
        source: HyloProSubscription.SOURCE_MANUAL,
        status: 'active',
        tier: grantTier,
        features: featuresColumn(overrides),
        expires_at: expires,
        granted_by_id: adminId,
        note: cleanNote(note),
        created_at: now,
        updated_at: now
      }).returning('id')
      return row.id || row
    })

    console.log(`Hylo Pro: admin ${adminId} granted ${grantTier} to group ${group.id} until ${expires ? expires.toISOString() : 'no end date'}${overrides ? ` with overrides ${JSON.stringify(overrides)}` : ''}`)
    return HyloProSubscription.where({ id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  /**
   * Changes an active grant's end date (null = no end date), its note, and/or its tier and feature
   * overrides (`features` replaces the overrides: pass [] to go back to the plain tier; omit it to
   * leave them alone — when only the tier changes, the overrides are re-read against the new tier).
   * Extending a grant that has already expired re-activates it. A revoked grant can't be changed;
   * grant again instead.
   */
  async updateGrant ({ adminId, id, tier, features, expiresAt, note }, now = new Date()) {
    const attrs = { updated_at: now }
    if (expiresAt !== undefined) attrs.expires_at = parseExpiresAt(expiresAt, now)
    if (note !== undefined) attrs.note = cleanNote(note)
    if (tier !== undefined) attrs.tier = parseTier(tier)

    const groupId = (await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL })).get('group_id')
    // Same lock as grant() and revokeGrant(). The row is read again inside it, so the checks below
    // see any change made while we waited (e.g. a revoke)
    const row = await withGrantLock(groupId, async trx => {
      const current = await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL, transacting: trx })
      if (current.get('status') !== 'active') throw new GraphQLError('This grant was revoked. Grant Pro again instead.')

      if (features !== undefined || attrs.tier !== undefined) {
        const nextTier = attrs.tier || current.tier()
        // Keeping the old overrides on a new tier: the same chosen features, re-expressed against it
        const chosen = features !== undefined
          ? features
          : Object.entries(current.featureOverrides()).map(([key, enabled]) => ({ key, enabled }))
        attrs.features = featuresColumn(parseFeatureOverrides(chosen, nextTier))
      }

      if (attrs.expires_at !== undefined && !HyloProSubscription.isActive(current, now)) {
        // Re-activating an expired grant: make sure the group doesn't end up with two active grants
        const other = await trx('hylo_pro_subscriptions')
          .where({ group_id: groupId, source: HyloProSubscription.SOURCE_MANUAL })
          .whereNot('id', current.id)
          .modify(q => HyloProSubscription.whereActive(q, now))
          .first('id')
        if (other) throw new GraphQLError('This group already has another active Hylo Pro grant')
      }
      await current.save(attrs, { patch: true, transacting: trx })
      return current
    })
    console.log(`Hylo Pro: admin ${adminId} updated grant ${row.id} (group ${groupId}): ${JSON.stringify(attrs)}`)
    return HyloProSubscription.where({ id: row.id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  // Ends a grant now. The row is kept (status 'canceled', ended_at) as a record
  async revokeGrant ({ adminId, id }, now = new Date()) {
    const groupId = (await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL })).get('group_id')
    const row = await withGrantLock(groupId, async trx => {
      const current = await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL, transacting: trx })
      if (current.get('status') !== 'active') throw new GraphQLError('This grant was already revoked')
      await current.save({ status: 'canceled', canceled_at: now, ended_at: now, updated_at: now }, { patch: true, transacting: trx })
      return current
    })
    console.log(`Hylo Pro: admin ${adminId} revoked grant ${row.id} (group ${groupId})`)
    return HyloProSubscription.where({ id: row.id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  /**
   * Cancels a Stripe subscription: at the end of the paid period (Pro stays on until then), or
   * immediately (Pro stops now; nothing is refunded — use refundPayment for that).
   */
  async cancelSubscription ({ adminId, id, immediately = false }) {
    const row = await findStripeRow(id)
    const subscriptionId = row.get('stripe_subscription_id')
    assertNotEnded(row)

    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId)
    } else {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
    }
    console.log(`Hylo Pro: admin ${adminId} cancelled subscription ${subscriptionId} (group ${row.get('group_id')}) ${immediately ? 'immediately' : 'at period end'}`)
    return resync(row)
  },

  // Undoes a scheduled cancellation, so the subscription renews again
  async resumeSubscription ({ adminId, id }) {
    const row = await findStripeRow(id)
    const subscriptionId = row.get('stripe_subscription_id')
    assertNotEnded(row)

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
    } else if (subscription.cancel_at) {
      // An empty string unsets a scheduled cancel_at
      await stripe.subscriptions.update(subscriptionId, { cancel_at: '' })
    } else {
      throw new GraphQLError('This subscription is not set to cancel')
    }
    console.log(`Hylo Pro: admin ${adminId} undid the cancellation of subscription ${subscriptionId} (group ${row.get('group_id')})`)
    return resync(row)
  },

  /**
   * Gives a Stripe subscription `days` of free Pro by pushing its next payment back: trial_end is
   * set to the later of now and the current period end, plus `days`, with no proration. The
   * subscription is 'trialing' until then (which gives Pro), keeps any scheduled cancellation (which
   * moves to the new end), and the next full charge happens at the new date, which becomes the
   * billing day from then on. Nothing already paid is refunded or credited.
   *
   * Stripe won't set a trial_end more than STRIPE_MAX_TRIAL_DAYS from now, so an extension that
   * would go past that (in one go or after earlier extensions) is refused with the most days that
   * can still be added (error code EXTEND_LIMIT, extensions.maxDays).
   */
  async extendSubscription ({ adminId, id, days }, now = new Date()) {
    const extra = Number(days)
    if (!Number.isInteger(extra) || extra < 1 || extra > MAX_EXTEND_DAYS) {
      throw new GraphQLError(`days must be a whole number from 1 to ${MAX_EXTEND_DAYS}`)
    }
    const row = await findStripeRow(id)
    const subscriptionId = row.get('stripe_subscription_id')

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (!HyloProSubscription.ACTIVE_STRIPE_STATUSES.includes(subscription.status)) {
      throw new GraphQLError('Only an active or trialing subscription can be extended. Grant Pro instead.')
    }
    if (subscription.cancel_at && !subscription.cancel_at_period_end) {
      throw new GraphQLError('This subscription is set to cancel on a fixed date. Undo the cancellation first.')
    }

    const nowSeconds = Math.floor(now.getTime() / 1000)
    const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end
    const fromSeconds = Math.max(periodEnd || 0, subscription.trial_end || 0, nowSeconds)
    const trialEnd = fromSeconds + extra * DAY_SECONDS
    const latestTrialEnd = nowSeconds + STRIPE_MAX_TRIAL_DAYS * DAY_SECONDS - TRIAL_LIMIT_MARGIN_SECONDS
    if (trialEnd > latestTrialEnd) {
      const maxDays = Math.max(Math.floor((latestTrialEnd - fromSeconds) / DAY_SECONDS), 0)
      const message = maxDays > 0
        ? `Stripe allows free time up to ${STRIPE_MAX_TRIAL_DAYS} days from today, so this subscription can be extended by at most ${maxDays} more days.`
        : `This subscription is already extended as far as Stripe allows (${STRIPE_MAX_TRIAL_DAYS} days from today).`
      throw new GraphQLError(message, { extensions: { code: EXTEND_LIMIT, maxDays, maxTrialDays: STRIPE_MAX_TRIAL_DAYS } })
    }

    await stripe.subscriptions.update(subscriptionId, { trial_end: trialEnd, proration_behavior: 'none' })
    console.log(`Hylo Pro: admin ${adminId} extended subscription ${subscriptionId} (group ${row.get('group_id')}) by ${extra} days to ${new Date(trialEnd * 1000).toISOString()}`)
    return resync(row)
  },

  /**
   * The Pro refunds and disputes recorded for groups from Stripe webhooks (stripe_logs rows of type
   * HyloProService.LOG_TYPE_REFUND / LOG_TYPE_DISPUTE): per group, how many disputes are still open
   * (not in CLOSED_DISPUTE_STATUSES) and how many payments have been refunded. Groups with neither
   * are left out.
   *
   * @returns {Promise<Map<string, { openDisputes: number, refunds: number }>>} keyed by group id
   */
  async chargeEventCounts (groupIds) {
    const ids = [...new Set((groupIds || []).filter(Boolean).map(String))]
    if (ids.length === 0) return new Map()
    const rows = await bookshelf.knex('stripe_logs')
      .whereIn('group_id', ids)
      .whereIn('log_type', [HyloProService.LOG_TYPE_REFUND, HyloProService.LOG_TYPE_DISPUTE])
      .groupBy('group_id')
      .select('group_id', bookshelf.knex.raw(
        `count(*) filter (where log_type = ? and status not in (${CLOSED_DISPUTE_STATUSES.map(() => '?').join(', ')})) as open_disputes,
         count(*) filter (where log_type = ?) as refunds`,
        [HyloProService.LOG_TYPE_DISPUTE, ...CLOSED_DISPUTE_STATUSES, HyloProService.LOG_TYPE_REFUND]
      ))
    return new Map(rows.map(row => [String(row.group_id), { openDisputes: Number(row.open_disputes), refunds: Number(row.refunds) }]))
  },

  /**
   * A group's recorded Pro refunds and disputes (see chargeEventCounts), most recently updated
   * first. One row per refunded payment (amount = total refunded on it so far) and one per dispute.
   */
  async listChargeEvents ({ groupId }) {
    const rows = await bookshelf.knex('stripe_logs')
      .where('group_id', groupIdOf(groupId))
      .whereIn('log_type', [HyloProService.LOG_TYPE_REFUND, HyloProService.LOG_TYPE_DISPUTE])
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .limit(CHARGE_EVENTS_LIMIT)
    return rows.map(row => {
      const isDispute = row.log_type === HyloProService.LOG_TYPE_DISPUTE
      return {
        id: row.id,
        type: isDispute ? 'dispute' : 'refund',
        chargeId: row.charge_id,
        externalId: row.external_id,
        amount: row.amount,
        currency: row.currency,
        reason: row.reason,
        status: row.status,
        open: isDispute && !CLOSED_DISPUTE_STATUSES.includes(row.status),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })
  },

  /**
   * Payments (charges) by the group's Hylo Pro customer, newest first, a page at a time: pass the
   * last charge id seen as `after` for the next page. That customer is only used for Hylo Pro, so
   * all its charges are Pro payments. Disputed charges carry their latest dispute's status and
   * refundBlock says whether that dispute stops a refund (see disputeRefundBlock). subscriptionId is
   * the Stripe subscription the charge paid for, if any: only that subscription can be cancelled
   * together with a refund of it.
   */
  async listPayments ({ groupId, after }) {
    const customerId = await HyloProService.stripeCustomerIdForGroup(groupIdOf(groupId))
    if (!customerId) return { items: [], hasMore: false }
    const params = { customer: customerId, limit: PAYMENTS_PAGE_SIZE }
    if (after) params.starting_after = after
    const charges = await stripe.charges.list(params)
    const [disputes, subscriptionIds] = await Promise.all([
      Promise.all(charges.data.map(charge => charge.disputed ? latestDispute(charge.id) : null)),
      Promise.all(charges.data.map(chargeSubscriptionId))
    ])
    return {
      items: charges.data.map((charge, i) => ({
        id: charge.id,
        amount: charge.amount,
        amountRefunded: charge.amount_refunded,
        currency: charge.currency,
        status: charge.status,
        paid: !!charge.paid,
        refunded: !!charge.refunded,
        disputed: !!charge.disputed,
        disputeStatus: disputes[i]?.status || null,
        refundBlock: disputeRefundBlock(charge, disputes[i]),
        subscriptionId: subscriptionIds[i],
        description: charge.description,
        createdAt: new Date(charge.created * 1000)
      })),
      hasMore: !!charges.has_more
    }
  },

  /**
   * Refunds a Pro payment, in full or `amount` cents of it. The charge must belong to the group's
   * Pro customer, and its dispute, if any, must allow a refund (see disputeRefundBlock: not while a
   * chargeback is open, and not after one was lost).
   *
   * A refund on its own doesn't change the subscription. Pass `cancelSubscriptionId` (one of the
   * group's Stripe rows, and the subscription this charge paid for) to also cancel that
   * subscription immediately once the refund has succeeded. If that cancellation fails the refund
   * still stands: the result then has subscriptionCanceled false and cancelError set, so staff can
   * cancel it separately.
   */
  async refundPayment ({ adminId, groupId, chargeId, amount, cancelSubscriptionId }) {
    const groupIdString = groupIdOf(groupId)
    const customerId = await HyloProService.stripeCustomerIdForGroup(groupIdString)
    if (!customerId) throw new GraphQLError('This group has no Hylo Pro payments')

    // Check the subscription to cancel before refunding, so a refusal here changes nothing
    let cancelRow = null
    if (cancelSubscriptionId) {
      cancelRow = await findStripeRow(cancelSubscriptionId)
      if (String(cancelRow.get('group_id')) !== groupIdString) throw new GraphQLError("This subscription isn't this group's")
      assertNotEnded(cancelRow)
    }

    let charge
    try {
      charge = await stripe.charges.retrieve(chargeId)
    } catch (error) {
      if (error.code === 'resource_missing') throw new GraphQLError('Payment not found')
      throw error
    }
    const chargeCustomer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
    if (chargeCustomer !== customerId) throw new GraphQLError("This payment isn't one of this group's Hylo Pro payments")
    const block = disputeRefundBlock(charge, charge.disputed ? await latestDispute(charge.id) : null)
    if (block === 'dispute_lost') throw new GraphQLError("This payment's dispute was lost, so the money has already gone back to the customer. Nothing can be refunded.")
    if (block) throw new GraphQLError("This payment has an open dispute, so it can't be refunded. Handle the dispute in Stripe.")
    if (cancelRow && await chargeSubscriptionId(charge) !== cancelRow.get('stripe_subscription_id')) {
      throw new GraphQLError("This payment isn't for that subscription, so it can't be cancelled with this refund")
    }

    const refundable = charge.amount - charge.amount_refunded
    if (!charge.paid || refundable <= 0) throw new GraphQLError('Nothing left to refund on this payment')
    const params = { charge: charge.id, metadata: { hylo_pro: 'true', group_id: groupIdString, refunded_by_id: String(adminId) } }
    if (amount !== null && amount !== undefined) {
      const cents = Number(amount)
      if (!Number.isInteger(cents) || cents < 1 || cents > refundable) {
        throw new GraphQLError(`amount must be a whole number of cents from 1 to ${refundable}`)
      }
      params.amount = cents
    }

    const refund = await stripe.refunds.create(params)
    console.log(`Hylo Pro: admin ${adminId} refunded ${refund.amount} of charge ${charge.id} (group ${groupIdString}), refund ${refund.id} ${refund.status}`)
    const result = { id: refund.id, amount: refund.amount, currency: refund.currency, status: refund.status, subscriptionCanceled: false, cancelError: null }

    if (cancelRow) {
      try {
        await module.exports.cancelSubscription({ adminId, id: cancelRow.id, immediately: true })
        result.subscriptionCanceled = true
      } catch (error) {
        console.error(`Hylo Pro: refund ${refund.id} succeeded but cancelling subscription row ${cancelRow.id} failed:`, error)
        result.cancelError = error.message || 'Unknown error'
      }
    }
    return result
  }
}
