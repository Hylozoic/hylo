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

function monthKey (date) {
  return date.toISOString().slice(0, 7) // YYYY-MM (UTC)
}

/**
 * Monthly recurring revenue in cents for one subscription, from the plan amounts in
 * HyloProService.PLANS — the CURRENT prices, not what each subscription actually pays. That's
 * right while there is one price per interval and no coupons; if prices change or discounts are
 * added, compute MRR from each subscription's own price instead.
 */
function monthlyAmount (interval) {
  const plan = HyloProService.PLANS[interval]
  if (!plan) return 0
  return interval === 'year' ? Math.round(plan.unitAmount / 12) : plan.unitAmount
}

// A group id as given to the API, which must be numeric (never a slug), or throws
function groupIdOf (groupId) {
  const id = String(groupId ?? '').trim()
  if (!/^\d+$/.test(id)) throw new GraphQLError('Group not found')
  return id
}

async function findGroupById (groupId) {
  const group = await Group.where({ id: groupIdOf(groupId) }).fetch()
  if (!group || !group.get('active')) throw new GraphQLError('Group not found')
  return group
}

async function findRow (id, { transacting, source } = {}) {
  const row = id && await HyloProSubscription.where({ id }).fetch({ transacting })
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
  monthlyAmount,

  /**
   * Hylo Pro numbers for the management page, all derived from hylo_pro_subscriptions.
   * "Active" uses the same rules as Group.hasPro (HyloProSubscription.whereActive). Paid
   * subscriptions and recurring revenue count the same rows: active and past_due (still in grace)
   * Stripe subscriptions, at the current plan prices (see monthlyAmount), a yearly plan as 1/12 per
   * month. Trialing subscriptions (e.g. extended ones) pay nothing now and are counted separately.
   */
  async metrics (now = new Date()) {
    const knex = bookshelf.knex
    const stripeSource = HyloProSubscription.SOURCE_STRIPE
    const manualSource = HyloProSubscription.SOURCE_MANUAL
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS)
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (METRICS_MONTHS - 1), 1))

    const [[active], [{ count: pastDue }], eventCounts] = await Promise.all([
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
      `, { stripeSource, firstMonth })
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
      mrrCents: payingMonthly * monthlyAmount('month') + payingYearly * monthlyAmount('year'),
      currency: HyloProService.CURRENCY,
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
      /^\d+$/.test(value) ? Group.where({ id: value, active: true }).fetch() : null
    ])
    if (bySlug && byId && bySlug.id === byId.id) return [bySlug]
    return [bySlug, byId].filter(Boolean)
  },

  /**
   * Grants a group Pro outside of payments. Refused while the group already has an active grant
   * (change that grant's end date instead), so a group never has two grants to keep track of.
   *
   * @param {string} groupId the group's id; never a slug (see findGroups)
   */
  async grant ({ adminId, groupId, expiresAt, note }, now = new Date()) {
    const group = await findGroupById(groupId)
    if (group.get('type') === 'space') throw new GraphQLError('Hylo Pro is only available for groups, not spaces')
    const expires = parseExpiresAt(expiresAt, now)

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
        expires_at: expires,
        granted_by_id: adminId,
        note: cleanNote(note),
        created_at: now,
        updated_at: now
      }).returning('id')
      return row.id || row
    })

    console.log(`Hylo Pro: admin ${adminId} granted Pro to group ${group.id} until ${expires ? expires.toISOString() : 'no end date'}`)
    return HyloProSubscription.where({ id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  /**
   * Changes an active grant's end date (null = no end date) and/or its note. Extending a grant
   * that has already expired re-activates it. A revoked grant can't be changed; grant again instead.
   */
  async updateGrant ({ adminId, id, expiresAt, note }, now = new Date()) {
    const attrs = { updated_at: now }
    if (expiresAt !== undefined) attrs.expires_at = parseExpiresAt(expiresAt, now)
    if (note !== undefined) attrs.note = cleanNote(note)

    const groupId = (await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL })).get('group_id')
    // Same lock as grant() and revokeGrant(). The row is read again inside it, so the checks below
    // see any change made while we waited (e.g. a revoke)
    const row = await withGrantLock(groupId, async trx => {
      const current = await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL, transacting: trx })
      if (current.get('status') !== 'active') throw new GraphQLError('This grant was revoked. Grant Pro again instead.')

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
   * Payments (charges) by the group's Hylo Pro customer, newest first, a page at a time: pass the
   * last charge id seen as `after` for the next page. That customer is only used for Hylo Pro, so
   * all its charges are Pro payments. Disputed charges carry their latest dispute's status.
   */
  async listPayments ({ groupId, after }) {
    const customerId = await HyloProService.stripeCustomerIdForGroup(groupIdOf(groupId))
    if (!customerId) return { items: [], hasMore: false }
    const params = { customer: customerId, limit: PAYMENTS_PAGE_SIZE }
    if (after) params.starting_after = after
    const charges = await stripe.charges.list(params)
    const disputes = await Promise.all(charges.data.map(charge => charge.disputed ? latestDispute(charge.id) : null))
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
        description: charge.description,
        createdAt: new Date(charge.created * 1000)
      })),
      hasMore: !!charges.has_more
    }
  },

  /**
   * Refunds a Pro payment, in full or `amount` cents of it. The charge must belong to the group's
   * Pro customer, and can't be disputed (Stripe returns disputed money through the dispute).
   *
   * A refund on its own doesn't change the subscription. Pass `cancelSubscriptionId` (one of the
   * group's Stripe rows) to also cancel that subscription immediately once the refund has
   * succeeded. If that cancellation fails the refund still stands: the result then has
   * subscriptionCanceled false and cancelError set, so staff can cancel it separately.
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
    if (charge.disputed) throw new GraphQLError("This payment is disputed, so it can't be refunded. Handle the dispute in Stripe.")

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
