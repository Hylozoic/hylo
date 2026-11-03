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

const DAY_MS = 24 * 60 * 60 * 1000
// How far back the monthly new/cancelled series goes, including the current month
const METRICS_MONTHS = 6
// Grants ending within this many days are counted as "expiring soon"
const EXPIRING_SOON_DAYS = 30
// Longest single extension of a Stripe subscription, so a typo can't give years away
const MAX_EXTEND_DAYS = 366
const MAX_NOTE_LENGTH = 1000
const PAGE_SIZE = 50

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

// Monthly recurring revenue in cents for one subscription, from the plan amounts in HyloProService.PLANS
function monthlyAmount (interval) {
  const plan = HyloProService.PLANS[interval]
  if (!plan) return 0
  return interval === 'year' ? Math.round(plan.unitAmount / 12) : plan.unitAmount
}

async function lockedTransaction (key, fn) {
  return bookshelf.transaction(async trx => {
    await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [key]).transacting(trx)
    return fn(trx)
  })
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

// Re-reads the subscription from Stripe and saves it (the same path webhooks use)
async function resync (row) {
  const synced = await HyloProService.syncSubscriptionById(row.get('stripe_subscription_id'))
  // syncSubscription skips subscriptions that aren't this group's customer's; fall back to a fresh read of our row
  return synced || HyloProSubscription.where({ id: row.id }).fetch()
}

module.exports = {
  METRICS_MONTHS,
  EXPIRING_SOON_DAYS,
  MAX_EXTEND_DAYS,
  LIST_FILTERS,
  monthlyAmount,

  /**
   * Hylo Pro numbers for the management page, all derived from hylo_pro_subscriptions.
   * "Active" uses the same rules as Group.hasPro (HyloProSubscription.isActive). Recurring revenue
   * counts active and past_due (still in grace) Stripe subscriptions at the current plan prices,
   * a yearly plan as 1/12 per month; trialing subscriptions (e.g. extended ones) pay nothing now
   * and aren't included.
   */
  async metrics (now = new Date()) {
    const rows = await bookshelf.knex('hylo_pro_subscriptions').select(
      'group_id', 'source', 'status', 'interval', 'current_period_start', 'current_period_end',
      'cancel_at_period_end', 'cancel_at', 'canceled_at', 'ended_at', 'expires_at', 'created_at'
    )

    const proGroups = new Set()
    const stripeGroups = new Set()
    const manualGroups = new Set()
    const byInterval = { month: 0, year: 0 }
    let mrrCents = 0
    let trialing = 0
    let cancelling = 0
    let pastDue = 0
    let expiringSoon = 0
    const soon = now.getTime() + EXPIRING_SOON_DAYS * DAY_MS

    // Months from oldest to current, UTC
    const months = []
    for (let i = METRICS_MONTHS - 1; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      months.push({ month: monthKey(date), newSubscriptions: 0, cancellations: 0, ended: 0, grants: 0 })
    }
    const byMonth = Object.fromEntries(months.map(m => [m.month, m]))
    const count = (date, field) => {
      const bucket = date && byMonth[monthKey(toDate(date))]
      if (bucket) bucket[field]++
    }

    for (const row of rows) {
      const active = HyloProSubscription.isActive(row, now)
      const isStripe = row.source === HyloProSubscription.SOURCE_STRIPE
      if (active) proGroups.add(row.group_id)

      if (isStripe) {
        count(row.created_at, 'newSubscriptions')
        count(row.canceled_at, 'cancellations')
        count(row.ended_at, 'ended')
        if (row.status === 'past_due' && !row.ended_at) pastDue++
        if (active) {
          stripeGroups.add(row.group_id)
          if (byInterval[row.interval] !== undefined) byInterval[row.interval]++
          if (row.status === 'trialing') trialing++
          else mrrCents += monthlyAmount(row.interval)
          if (row.cancel_at_period_end || row.cancel_at) cancelling++
        }
      } else {
        count(row.created_at, 'grants')
        if (active) {
          manualGroups.add(row.group_id)
          if (row.expires_at && toDate(row.expires_at).getTime() <= soon) expiringSoon++
        }
      }
    }

    return {
      activeGroups: proGroups.size,
      stripeGroups: stripeGroups.size,
      manualGroups: manualGroups.size,
      monthlySubscriptions: byInterval.month,
      yearlySubscriptions: byInterval.year,
      trialing,
      cancelling,
      pastDue,
      grantsExpiringSoon: expiringSoon,
      mrrCents,
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

    const [{ count }] = await bookshelf.knex('hylo_pro_subscriptions').modify(scope).count()
    const items = await HyloProSubscription.query(q => {
      scope(q)
      q.orderBy('created_at', 'desc')
      q.orderBy('id', 'desc')
      q.limit(limit)
      q.offset(skip)
    }).fetchAll({ withRelated: ['group', 'grantedBy'] })

    const total = Number(count)
    return { items: items.models, total, hasMore: skip + items.length < total }
  },

  /**
   * Grants a group Pro outside of payments. Refused while the group already has an active grant
   * (change that grant's end date instead), so a group never has two grants to keep track of.
   */
  async grant ({ adminId, groupId, expiresAt, note }, now = new Date()) {
    const group = await Group.find(groupId)
    if (!group || !group.get('active')) throw new GraphQLError('Group not found')
    if (group.get('type') === 'space') throw new GraphQLError('Hylo Pro is only available for groups, not spaces')
    const expires = parseExpiresAt(expiresAt, now)

    const id = await lockedTransaction(`hylo_pro_grant:${group.id}`, async trx => {
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
    const row = await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL })
    if (row.get('status') !== 'active') throw new GraphQLError('This grant was revoked. Grant Pro again instead.')

    const attrs = { updated_at: now }
    if (expiresAt !== undefined) attrs.expires_at = parseExpiresAt(expiresAt, now)
    if (note !== undefined) attrs.note = cleanNote(note)

    // Same lock as grant(), so re-activating an expired grant can't race a new grant for the group
    await lockedTransaction(`hylo_pro_grant:${row.get('group_id')}`, async trx => {
      if (attrs.expires_at !== undefined && !HyloProSubscription.isActive(row, now)) {
        // Re-activating an expired grant: make sure the group doesn't end up with two active grants
        const other = await trx('hylo_pro_subscriptions')
          .where({ group_id: row.get('group_id'), source: HyloProSubscription.SOURCE_MANUAL })
          .whereNot('id', row.id)
          .modify(q => HyloProSubscription.whereActive(q, now))
          .first('id')
        if (other) throw new GraphQLError('This group already has another active Hylo Pro grant')
      }
      await row.save(attrs, { patch: true, transacting: trx })
    })
    console.log(`Hylo Pro: admin ${adminId} updated grant ${row.id} (group ${row.get('group_id')}): ${JSON.stringify(attrs)}`)
    return HyloProSubscription.where({ id: row.id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  // Ends a grant now. The row is kept (status 'canceled', ended_at) as a record
  async revokeGrant ({ adminId, id }, now = new Date()) {
    const row = await findRow(id, { source: HyloProSubscription.SOURCE_MANUAL })
    if (row.get('status') !== 'active') throw new GraphQLError('This grant was already revoked')
    await row.save({ status: 'canceled', canceled_at: now, ended_at: now, updated_at: now }, { patch: true })
    console.log(`Hylo Pro: admin ${adminId} revoked grant ${row.id} (group ${row.get('group_id')})`)
    return HyloProSubscription.where({ id: row.id }).fetch({ withRelated: ['group', 'grantedBy'] })
  },

  /**
   * Cancels a Stripe subscription: at the end of the paid period (Pro stays on until then), or
   * immediately (Pro stops now; nothing is refunded — use refundPayment for that).
   */
  async cancelSubscription ({ adminId, id, immediately = false }) {
    const row = await findStripeRow(id)
    const subscriptionId = row.get('stripe_subscription_id')
    if (HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(row.get('status'))) {
      throw new GraphQLError('This subscription has already ended')
    }

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
    if (HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(row.get('status'))) {
      throw new GraphQLError('This subscription has already ended')
    }

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

    const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end
    const fromSeconds = Math.max(periodEnd || 0, subscription.trial_end || 0, Math.floor(now.getTime() / 1000))
    const trialEnd = fromSeconds + extra * 24 * 60 * 60
    await stripe.subscriptions.update(subscriptionId, { trial_end: trialEnd, proration_behavior: 'none' })
    console.log(`Hylo Pro: admin ${adminId} extended subscription ${subscriptionId} (group ${row.get('group_id')}) by ${extra} days to ${new Date(trialEnd * 1000).toISOString()}`)
    return resync(row)
  },

  /**
   * Recent payments (charges) by the group's Hylo Pro customer. That customer is only used for
   * Hylo Pro, so all its charges are Pro payments.
   */
  async listPayments ({ groupId }) {
    const customerId = await HyloProService.stripeCustomerIdForGroup(groupId)
    if (!customerId) return []
    const charges = await stripe.charges.list({ customer: customerId, limit: 20 })
    return charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
      currency: charge.currency,
      status: charge.status,
      paid: !!charge.paid,
      refunded: !!charge.refunded,
      description: charge.description,
      createdAt: new Date(charge.created * 1000)
    }))
  },

  /**
   * Refunds a Pro payment, in full or `amount` cents of it. The charge must belong to the group's
   * Pro customer. A refund doesn't change the subscription; cancel it separately if needed.
   */
  async refundPayment ({ adminId, groupId, chargeId, amount }) {
    const customerId = await HyloProService.stripeCustomerIdForGroup(groupId)
    if (!customerId) throw new GraphQLError('This group has no Hylo Pro payments')

    let charge
    try {
      charge = await stripe.charges.retrieve(chargeId)
    } catch (error) {
      if (error.code === 'resource_missing') throw new GraphQLError('Payment not found')
      throw error
    }
    const chargeCustomer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
    if (chargeCustomer !== customerId) throw new GraphQLError("This payment isn't one of this group's Hylo Pro payments")

    const refundable = charge.amount - charge.amount_refunded
    if (!charge.paid || refundable <= 0) throw new GraphQLError('Nothing left to refund on this payment')
    const params = { charge: charge.id, metadata: { hylo_pro: 'true', group_id: String(groupId), refunded_by_id: String(adminId) } }
    if (amount !== null && amount !== undefined) {
      const cents = Number(amount)
      if (!Number.isInteger(cents) || cents < 1 || cents > refundable) {
        throw new GraphQLError(`amount must be a whole number of cents from 1 to ${refundable}`)
      }
      params.amount = cents
    }

    const refund = await stripe.refunds.create(params)
    console.log(`Hylo Pro: admin ${adminId} refunded ${refund.amount} of charge ${charge.id} (group ${groupId}), refund ${refund.id} ${refund.status}`)
    return { id: refund.id, amount: refund.amount, currency: refund.currency, status: refund.status }
  }
}
