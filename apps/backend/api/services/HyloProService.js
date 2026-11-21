/**
 * HyloProService
 *
 * Hylo Pro is a group paying Hylo directly, so everything here runs on the Hylo PLATFORM Stripe
 * account — never pass `stripeAccount` (that is Stripe Connect, used by StripeService for groups
 * selling to their members).
 *
 * - ensureProPrices / ensurePortalConfiguration create the "Hylo Pro" product, its $10/month and
 *   $100/year prices, and a Customer Portal configuration on first use, then cache their ids.
 * - Each group pays with one platform customer (hylo_pro_customers), created before its first Checkout.
 * - createCheckoutSession / createPortalSession return Stripe-hosted URLs for sign-up and for
 *   cancelling, switching interval or updating the card. Checkout is refused while the group's
 *   customer has a subscription that isn't over yet (checked in Stripe, not just our table), and an
 *   open Checkout for the group is reused (same interval) or expired (other interval), so a group
 *   can't end up paying twice.
 * - Pro subscriptions are tagged with metadata { hylo_pro: 'true', group_id }. isHyloProEvent picks
 *   their webhooks out (platform events only). Webhooks, and activateCheckoutSession when a steward
 *   returns from Checkout, call syncSubscriptionById: under a per-subscription lock it re-reads the
 *   subscription from Stripe and upserts its hylo_pro_subscriptions row, so concurrent, retried or
 *   out-of-order events always leave the latest state. Only subscriptions whose customer matches the
 *   group's hylo_pro_customers row are synced.
 * - resyncSubscriptions runs from the hourly cron job and re-syncs 1/24 of the groups each hour, so
 *   every Pro subscription is checked against Stripe once a day even if a webhook was missed.
 * - Refunds and disputes of Pro payments (charge.refunded, charge.dispute.*) are recorded in
 *   stripe_logs with their own log types (hylo_pro_refund, hylo_pro_dispute), apart from the
 *   Connect refund/dispute rows that drive groups' dispute-rate alerts.
 */

const Stripe = require('stripe')
const { GraphQLError } = require('graphql')

/* global bookshelf, Frontend, Group, HyloProSubscription */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover'
})

// A fixed product id means we can retrieve it directly (products.search is eventually consistent)
const PRODUCT_ID = 'hylo_pro'
const PRODUCT_NAME = 'Hylo Pro'
const PRO_METADATA_KEY = 'hylo_pro'
const PORTAL_METADATA_KEY = 'hylo_pro_portal'
const CURRENCY = 'usd'

const PLANS = {
  month: { lookupKey: 'hylo_pro_monthly_usd', unitAmount: 1000 },
  year: { lookupKey: 'hylo_pro_yearly_usd', unitAmount: 10000 }
}
const INTERVALS = Object.keys(PLANS)

// Event types that can change a Pro subscription's state
const PRO_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed'
])

// Refund and dispute events about a payment. Pro payments are found by their customer (see handleChargeEvent).
const CHARGE_EVENT_TYPES = new Set([
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated'
])

// stripe_logs.log_type for Pro payments; Connect rows use 'refund' and 'dispute'
const LOG_TYPE_REFUND = 'hylo_pro_refund'
const LOG_TYPE_DISPUTE = 'hylo_pro_dispute'

// The scheduled re-sync runs hourly and takes one of this many slices of the groups each time
const RESYNC_SLOTS = 24

// Error code for "this group already has a subscription"; the web shows its own translated message
const ALREADY_SUBSCRIBED = 'HYLO_PRO_ALREADY_SUBSCRIBED'

function alreadySubscribedError () {
  return new GraphQLError('This group already has a Hylo Pro subscription. Use Manage subscription to change it.', {
    extensions: { code: ALREADY_SUBSCRIBED }
  })
}

async function advisoryLock (key, transacting) {
  await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [key])
    .transacting(transacting)
}

/**
 * Runs fn(trx) holding a Postgres advisory lock on `key`, so callers using the same key run one at
 * a time (across all backend processes). The lock is released when the transaction ends. Pass
 * `transacting` to take the lock inside an existing transaction instead of opening a new one.
 */
async function withLock (key, fn, { transacting } = {}) {
  if (transacting) {
    await advisoryLock(key, transacting)
    return fn(transacting)
  }
  return bookshelf.transaction(async trx => {
    await advisoryLock(key, trx)
    return fn(trx)
  })
}

let cachedPriceIds = null
let cachedPortalConfigurationId = null

function dateFromUnix (seconds) {
  return seconds ? new Date(seconds * 1000) : null
}

function idOf (value) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id || null
}

/**
 * Pro metadata for a checkout session, subscription or invoice, or null if it isn't a Pro object.
 * Invoices carry their subscription's metadata under parent.subscription_details (API 2025-03+),
 * or subscription_details on older API versions.
 */
function proMetadataOf (object) {
  if (!object) return null
  const candidates = [
    object.metadata,
    object.parent?.subscription_details?.metadata,
    object.subscription_details?.metadata
  ]
  return candidates.find(m => m && m[PRO_METADATA_KEY] === 'true') || null
}

function subscriptionIdOf (object) {
  if (!object) return null
  if (object.object === 'subscription') return object.id
  return idOf(object.subscription) || idOf(object.parent?.subscription_details?.subscription)
}

// Whether a portal configuration's features already match what ensurePortalConfiguration wants
function portalFeaturesMatch (actual, wanted) {
  if (!actual) return false
  const sorted = list => [...(list || [])].sort().join()
  const prices = features => sorted((features?.subscription_update?.products || []).flatMap(p => p.prices || []))
  return prices(actual) === prices(wanted) &&
    sorted(actual.customer_update?.allowed_updates) === sorted(wanted.customer_update.allowed_updates) &&
    ['customer_update', 'invoice_history', 'payment_method_update', 'subscription_cancel', 'subscription_update']
      .every(name => !!actual[name]?.enabled === wanted[name].enabled) &&
    actual.subscription_cancel?.mode === wanted.subscription_cancel.mode &&
    actual.subscription_update?.proration_behavior === wanted.subscription_update.proration_behavior &&
    sorted(actual.subscription_update?.default_allowed_updates) === sorted(wanted.subscription_update.default_allowed_updates)
}

// Inserts a stripe_logs row, or updates the one with the same log_type and external_id
async function upsertStripeLog (row, { transacting } = {}) {
  const knex = transacting || bookshelf.knex
  const now = new Date()
  const { log_type: logType, external_id: externalId, ...changes } = row
  const [saved] = await knex('stripe_logs')
    .insert({ ...row, created_at: now, updated_at: now })
    .onConflict(['log_type', 'external_id'])
    .merge({ ...changes, updated_at: now })
    .returning('*')
  return saved
}

function billingUrl (group) {
  return `${Frontend.Route.groupSettings(group)}/billing`
}

module.exports = {
  PRODUCT_ID,
  PLANS,
  INTERVALS,
  CURRENCY,
  ALREADY_SUBSCRIBED,
  LOG_TYPE_REFUND,
  LOG_TYPE_DISPUTE,
  RESYNC_SLOTS,
  alreadySubscribedError,

  // Plans in display order, for the Billing page
  plans () {
    return INTERVALS.map(interval => ({ interval, unitAmount: PLANS[interval].unitAmount, currency: CURRENCY }))
  },

  // For tests: forget ids cached from earlier calls
  clearCache () {
    cachedPriceIds = null
    cachedPortalConfigurationId = null
  },

  async ensureProduct () {
    try {
      const product = await stripe.products.retrieve(PRODUCT_ID)
      if (!product.active) {
        return stripe.products.update(PRODUCT_ID, { active: true })
      }
      return product
    } catch (error) {
      if (error.code !== 'resource_missing') throw error
      return stripe.products.create({
        id: PRODUCT_ID,
        name: PRODUCT_NAME,
        description: 'Extra features for your Hylo group',
        metadata: { [PRO_METADATA_KEY]: 'true' }
      })
    }
  },

  /**
   * Ensures the Hylo Pro product and its monthly/yearly prices exist on the platform account.
   * Prices are found by lookup_key; a price whose amount no longer matches PLANS is replaced
   * (transfer_lookup_key moves the key to the new price).
   *
   * @returns {Promise<{ month: string, year: string }>} price ids by interval
   */
  async ensureProPrices () {
    if (cachedPriceIds) return cachedPriceIds

    const product = await this.ensureProduct()
    const lookupKeys = INTERVALS.map(interval => PLANS[interval].lookupKey)
    const existing = await stripe.prices.list({ lookup_keys: lookupKeys, active: true, limit: lookupKeys.length })

    const priceIds = {}
    for (const interval of INTERVALS) {
      const { lookupKey, unitAmount } = PLANS[interval]
      const match = existing.data.find(price =>
        price.lookup_key === lookupKey &&
        idOf(price.product) === product.id &&
        price.unit_amount === unitAmount &&
        price.currency === CURRENCY &&
        price.recurring?.interval === interval &&
        (price.recurring?.interval_count || 1) === 1
      )
      if (match) {
        priceIds[interval] = match.id
      } else {
        const created = await stripe.prices.create({
          product: product.id,
          currency: CURRENCY,
          unit_amount: unitAmount,
          recurring: { interval },
          lookup_key: lookupKey,
          transfer_lookup_key: true,
          metadata: { [PRO_METADATA_KEY]: 'true' }
        })
        priceIds[interval] = created.id
      }
    }

    cachedPriceIds = priceIds
    return priceIds
  },

  /**
   * Ensures a Customer Portal configuration for Hylo Pro: cancel at period end, switch between
   * the monthly and yearly prices, update the card, see invoices. Kept separate from the platform's
   * default portal configuration so it can't affect anything else.
   *
   * @returns {Promise<string>} configuration id
   */
  async ensurePortalConfiguration () {
    if (cachedPortalConfigurationId) return cachedPortalConfigurationId

    const priceIds = await this.ensureProPrices()
    const features = {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [{ product: PRODUCT_ID, prices: [priceIds.month, priceIds.year] }]
      }
    }

    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
    const existing = configurations.data.find(c => c.metadata && c.metadata[PORTAL_METADATA_KEY] === 'true')

    let configuration
    if (!existing) {
      configuration = await stripe.billingPortal.configurations.create({
        business_profile: { headline: 'Manage your Hylo Pro subscription' },
        features,
        metadata: { [PORTAL_METADATA_KEY]: 'true' }
      })
    } else {
      configuration = portalFeaturesMatch(existing.features, features)
        ? existing
        : await stripe.billingPortal.configurations.update(existing.id, { features })
    }

    cachedPortalConfigurationId = configuration.id
    return configuration.id
  },

  // The platform customer this group pays with, or null if it never started a Checkout
  async stripeCustomerIdForGroup (groupId, { transacting } = {}) {
    const knex = transacting || bookshelf.knex
    const row = await knex('hylo_pro_customers').where({ group_id: groupId }).first('stripe_customer_id')
    return row ? row.stripe_customer_id : null
  },

  /**
   * Returns the group's platform customer, creating and recording it on first use. Runs under a
   * per-group lock in its own short transaction, so the recorded customer is committed even if the
   * Checkout that needed it then fails.
   */
  async ensureCustomer (group) {
    return withLock(`hylo_pro_customer:${group.id}`, trx => this.ensureCustomerLocked(group, trx))
  },

  async ensureCustomerLocked (group, trx) {
    const existing = await this.stripeCustomerIdForGroup(group.id, { transacting: trx })
    let customerId = existing
    if (!customerId) {
      // The caller holds the group's customer lock, so two customers can't be created for one group at once
      const customer = await stripe.customers.create({
        name: group.get('name'),
        metadata: { [PRO_METADATA_KEY]: 'true', group_id: String(group.id) }
      })
      customerId = customer.id
    }
    const now = new Date()
    await trx('hylo_pro_customers')
      .insert({ group_id: group.id, stripe_customer_id: customerId, created_at: now, updated_at: now })
      .onConflict('group_id')
      .ignore()
    const row = await trx('hylo_pro_customers').where({ group_id: group.id }).first('stripe_customer_id')
    return row.stripe_customer_id
  },

  /**
   * Starts a Stripe-hosted Checkout for a group to subscribe to Hylo Pro.
   *
   * Runs under a per-group lock. Stripe decides whether the group is already subscribed, not our
   * table: throws alreadySubscribedError() if the group's customer has a subscription in Stripe that
   * isn't over (anything but canceled / incomplete_expired). Those are synced into our table first
   * (covering a webhook that hasn't arrived yet), and so are local rows that still look open when
   * Stripe has none (covering a missed cancellation), so a stale row can't block Checkout. An open
   * Checkout for the same interval is returned instead of creating another; one for the other
   * interval is expired, so only one Checkout for the group can ever be completed.
   *
   * @returns {Promise<{ url: string, sessionId: string }>}
   */
  async createCheckoutSession ({ group, interval, userId }) {
    if (!INTERVALS.includes(interval)) {
      throw new Error(`Unknown Hylo Pro interval: ${interval}`)
    }

    // Neither needs the checkout lock: prices are shared (and cached), and ensureCustomer locks itself
    const priceIds = await this.ensureProPrices()
    const customerId = await this.ensureCustomer(group)

    const result = await withLock(`hylo_pro_checkout:${group.id}`, async trx => {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
      const open = subscriptions.data.filter(sub => !HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(sub.status))
      if (open.length > 0) {
        for (const sub of open) await this.syncSubscriptionById(sub.id, { transacting: trx })
        // Return rather than throw so the syncs commit
        return { alreadySubscribed: true }
      }

      // Stripe has nothing open for this customer: re-sync any of our rows that still say otherwise
      const rows = (await HyloProSubscription.forGroup(group.id, { transacting: trx })).models
      const stale = rows.filter(row => row.get('stripe_subscription_id') && HyloProSubscription.isOpenStripeSubscription(row))
      for (const row of stale) {
        let synced
        try {
          synced = await this.syncSubscriptionById(row.get('stripe_subscription_id'), { transacting: trx })
        } catch (error) {
          // Gone from Stripe entirely (e.g. deleted test data): nothing there to block a new subscription
          if (error.code !== 'resource_missing') throw error
          console.warn(`Hylo Pro subscription ${row.get('stripe_subscription_id')} no longer exists in Stripe`)
        }
        if (HyloProSubscription.isOpenStripeSubscription(synced)) return { alreadySubscribed: true }
      }

      const openSessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 })
      for (const existing of openSessions.data) {
        const metadata = proMetadataOf(existing)
        if (!metadata || String(metadata.group_id) !== String(group.id)) continue
        if (metadata.interval === interval && existing.url) {
          return { url: existing.url, sessionId: existing.id }
        }
        await stripe.checkout.sessions.expire(existing.id)
      }

      const metadata = {
        [PRO_METADATA_KEY]: 'true',
        group_id: String(group.id)
      }
      const returnUrl = billingUrl(group)
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceIds[interval], quantity: 1 }],
        customer: customerId,
        client_reference_id: String(group.id),
        metadata: { ...metadata, interval, user_id: String(userId) },
        subscription_data: { metadata },
        // Stripe fills in the session id, so the Billing page can activate Pro without waiting for the webhook
        success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?checkout=canceled`
      })

      return { url: session.url, sessionId: session.id }
    })

    if (result.alreadySubscribed) throw alreadySubscribedError()
    return result
  },

  /**
   * Called when a steward returns from Checkout: syncs the session's subscription right away, so
   * Pro doesn't depend on the webhook arriving first. The session must be a Pro Checkout for this group.
   *
   * @returns {Promise<HyloProSubscription|null>} the synced row, or null if the session has no subscription yet
   */
  async activateCheckoutSession ({ group, sessionId }) {
    let session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (error) {
      if (error.code === 'resource_missing') throw new GraphQLError('Checkout session not found')
      throw error
    }

    const metadata = proMetadataOf(session)
    if (!metadata || session.mode !== 'subscription' || String(metadata.group_id) !== String(group.id)) {
      throw new GraphQLError('This checkout session is not a Hylo Pro checkout for this group')
    }

    const subscriptionId = idOf(session.subscription)
    if (!subscriptionId) return null
    return this.syncSubscriptionById(subscriptionId)
  },

  /**
   * Opens the Stripe-hosted Customer Portal for the customer this group pays with.
   *
   * @returns {Promise<{ url: string } | null>} null if the group has no customer yet
   */
  async createPortalSession ({ group }) {
    const customerId = await this.stripeCustomerIdForGroup(group.id)
    if (!customerId) return null

    const configuration = await this.ensurePortalConfiguration()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration,
      return_url: billingUrl(group)
    })
    return { url: session.url }
  },

  /**
   * True for platform-account (non-Connect) events about a Hylo Pro checkout, subscription or invoice.
   * Connect events (event.account set) are never Pro events, even if their metadata looks like it.
   * Any event type counts, so a Pro object never reaches the Connect handlers.
   */
  isHyloProEvent (event) {
    if (!event || event.account) return false
    return !!proMetadataOf(event.data?.object)
  },

  /**
   * Applies a Pro event (see isHyloProEvent). Event types that can't change the subscription are ignored.
   *
   * @returns {Promise<HyloProSubscription|null>} the synced row, or null if nothing was synced
   */
  async handleWebhookEvent (event) {
    if (!PRO_EVENT_TYPES.has(event.type)) return null

    const object = event.data?.object
    if (event.type === 'checkout.session.completed' && object?.mode !== 'subscription') return null

    const subscriptionId = subscriptionIdOf(object)
    if (!subscriptionId) {
      console.warn(`Hylo Pro webhook ${event.id} (${event.type}) has no subscription id`)
      return null
    }

    return this.syncSubscriptionById(subscriptionId)
  },

  /**
   * True for a platform-account (non-Connect) refund or dispute event. Whether the payment was for
   * Pro is only known once handleChargeEvent has looked up its customer.
   */
  isChargeEvent (event) {
    return !!event && !event.account && CHARGE_EVENT_TYPES.has(event.type)
  },

  /**
   * Records a refund or dispute of a Hylo Pro payment (see isChargeEvent) in stripe_logs, so Hylo
   * staff can see it. A payment is a Pro payment when its customer is a group's Hylo Pro customer
   * (hylo_pro_customers): that customer is only used for Pro. The charge or dispute is re-read from
   * Stripe under a lock, so retried and out-of-order events leave the latest state, one row per
   * charge (refunds) or per dispute.
   *
   * Neither changes the subscription: a refund made in the Stripe dashboard doesn't cancel it, and
   * cancelling sends its own subscription events.
   *
   * @returns {Promise<object|null>} the stripe_logs row, or null if the payment isn't a Pro payment
   */
  async handleChargeEvent (event) {
    if (!this.isChargeEvent(event)) return null
    const object = event.data?.object
    if (!object?.id) return null

    if (event.type === 'charge.refunded') {
      // Not a Pro customer: skip without calling Stripe (most platform charges aren't Pro)
      const customerId = idOf(object.customer)
      if (!customerId || !await this.groupIdForCustomer(customerId)) return null
      return withLock(`hylo_pro_charge:${object.id}`, async trx => {
        const charge = await stripe.charges.retrieve(object.id, { expand: ['refunds'] })
        return this.recordRefund(charge, { transacting: trx })
      })
    }

    return withLock(`hylo_pro_dispute:${object.id}`, async trx => {
      const dispute = await stripe.disputes.retrieve(object.id, { expand: ['charge'] })
      return this.recordDispute(dispute, { transacting: trx })
    })
  },

  async groupIdForCustomer (customerId, { transacting } = {}) {
    if (!customerId) return null
    const knex = transacting || bookshelf.knex
    const row = await knex('hylo_pro_customers').where({ stripe_customer_id: customerId }).first('group_id')
    return row ? row.group_id : null
  },

  // Upserts the hylo_pro_refund row for a charge (one per charge; amount is the total refunded so far)
  async recordRefund (charge, { transacting } = {}) {
    const customerId = idOf(charge.customer)
    const groupId = await this.groupIdForCustomer(customerId, { transacting })
    if (!groupId) return null
    const refunds = charge.refunds?.data || []
    return upsertStripeLog({
      group_id: groupId,
      log_type: LOG_TYPE_REFUND,
      external_id: charge.id,
      charge_id: charge.id,
      amount: charge.amount_refunded,
      currency: charge.currency || CURRENCY,
      // Stripe lists refunds newest first
      reason: refunds[0]?.reason || null,
      status: charge.refunded ? 'refunded' : 'partially_refunded',
      metadata: {
        stripe_customer_id: customerId,
        charge_amount: charge.amount,
        refund_ids: refunds.map(refund => refund.id)
      }
    }, { transacting })
  },

  // Upserts the hylo_pro_dispute row for a dispute (dispute.charge expanded)
  async recordDispute (dispute, { transacting } = {}) {
    const charge = typeof dispute.charge === 'object' ? dispute.charge : null
    const customerId = idOf(charge?.customer)
    const groupId = await this.groupIdForCustomer(customerId, { transacting })
    if (!groupId) return null
    return upsertStripeLog({
      group_id: groupId,
      log_type: LOG_TYPE_DISPUTE,
      external_id: dispute.id,
      charge_id: idOf(dispute.charge),
      amount: dispute.amount,
      currency: dispute.currency || CURRENCY,
      reason: dispute.reason || null,
      status: dispute.status,
      metadata: { stripe_customer_id: customerId }
    }, { transacting })
  },

  /**
   * The scheduled re-sync (hourly cron): re-syncs every group whose hylo_pro_customers id falls in
   * `slot` (id % slots), so with the default 24 slots and slot = the UTC hour each group is checked
   * once a day. For each group it asks Stripe for the customer's subscriptions, then syncs any that
   * are new to us or not over yet, and any row of ours that isn't over yet — which also catches a
   * subscription Stripe no longer has. A failure for one group is logged and the run goes on; on a
   * Stripe rate limit the run stops, and those groups are checked again the next day. Calls are
   * made one at a time, a few per group, far below Stripe's rate limits. Safe to run again: each
   * sync just writes Stripe's current state.
   *
   * @returns {Promise<{ customers: number, synced: number, failed: number, rateLimited: boolean }>}
   */
  async resyncSubscriptions ({ slot, slots = RESYNC_SLOTS } = {}) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots) {
      throw new Error(`Hylo Pro re-sync slot must be an integer from 0 to ${slots - 1}, got ${slot}`)
    }
    const customers = await bookshelf.knex('hylo_pro_customers')
      .whereRaw('id % ? = ?', [slots, slot])
      .orderBy('id')
      .select('group_id', 'stripe_customer_id')

    const result = { customers: customers.length, synced: 0, failed: 0, rateLimited: false }
    for (const customer of customers) {
      try {
        result.synced += await this.resyncCustomer(customer)
      } catch (error) {
        if (error.type === 'StripeRateLimitError') {
          console.warn(`Hylo Pro re-sync hit Stripe's rate limit at group ${customer.group_id}; stopping this run`)
          result.rateLimited = true
          break
        }
        result.failed++
        console.error(`Hylo Pro re-sync failed for group ${customer.group_id}:`, error.message)
      }
    }
    return result
  },

  // Re-syncs one group's subscriptions (see resyncSubscriptions). Returns how many were synced.
  async resyncCustomer ({ group_id: groupId, stripe_customer_id: customerId }) {
    const listed = []
    let startingAfter
    do {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      })
      listed.push(...page.data)
      startingAfter = page.has_more && page.data.length > 0 ? page.data[page.data.length - 1].id : null
    } while (startingAfter)

    const rows = await bookshelf.knex('hylo_pro_subscriptions')
      .where({ group_id: groupId, source: HyloProSubscription.SOURCE_STRIPE })
      .whereNotNull('stripe_subscription_id')
      .select('stripe_subscription_id', 'status')
    const statusById = new Map(rows.map(row => [row.stripe_subscription_id, row.status]))
    const isOver = status => HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(status)

    const ids = new Set()
    for (const subscription of listed) {
      if (!proMetadataOf(subscription)) continue
      // Over in Stripe and already recorded as over: it can't change any more
      if (isOver(subscription.status) && statusById.get(subscription.id) === subscription.status) continue
      ids.add(subscription.id)
    }
    for (const row of rows) {
      if (!isOver(row.status)) ids.add(row.stripe_subscription_id)
    }

    let synced = 0
    for (const id of ids) {
      try {
        if (await this.syncSubscriptionById(id)) synced++
      } catch (error) {
        if (error.code !== 'resource_missing') throw error
        console.warn(`Hylo Pro subscription ${id} no longer exists in Stripe`)
      }
    }
    return synced
  },

  /**
   * Re-reads a subscription from Stripe and upserts its row. Holds a lock on the subscription id
   * from before the read until the write commits, so when two syncs overlap the later one reads
   * Stripe after the earlier one has written — an older snapshot can never overwrite a newer one.
   *
   * @returns {Promise<HyloProSubscription|null>}
   */
  async syncSubscriptionById (subscriptionId, { transacting } = {}) {
    return withLock(`hylo_pro_subscription:${subscriptionId}`, async trx => {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      return this.syncSubscription(subscription, { transacting: trx })
    }, { transacting })
  },

  /**
   * Upserts the hylo_pro_subscriptions row for a Stripe subscription object. Use syncSubscriptionById
   * unless the caller holds that subscription's lock and has just read it from Stripe.
   *
   * Only syncs a subscription whose customer is the one recorded for the group (hylo_pro_customers),
   * so a subscription made outside our Checkout can't attach itself to a group via its metadata.
   *
   * @returns {Promise<HyloProSubscription|null>} null if it isn't a Pro subscription for a known group
   */
  async syncSubscription (subscription, { transacting } = {}) {
    const metadata = proMetadataOf(subscription)
    if (!metadata) {
      console.warn(`Stripe subscription ${subscription?.id} is not a Hylo Pro subscription, skipping`)
      return null
    }

    const groupId = metadata.group_id
    const group = groupId && await Group.find(groupId)
    if (!group) {
      // Returning (not throwing) acknowledges the event: retrying can't make the group appear
      console.warn(`Hylo Pro subscription ${subscription.id} references unknown group ${groupId}`)
      return null
    }

    const knex = transacting || bookshelf.knex
    const customerId = idOf(subscription.customer)
    const customer = await knex('hylo_pro_customers').where({ group_id: group.id }).first('stripe_customer_id')
    if (!customer || customer.stripe_customer_id !== customerId) {
      console.warn(`Hylo Pro subscription ${subscription.id} (customer ${customerId}) is not for group ${group.id}'s customer here, skipping`)
      return null
    }

    const item = subscription.items?.data?.[0]
    const price = item?.price
    const now = new Date()
    const attrs = {
      group_id: group.id,
      source: HyloProSubscription.SOURCE_STRIPE,
      status: subscription.status,
      interval: price?.recurring?.interval || null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id || null,
      // Since API 2025-03-31 the billing period lives on the subscription item
      current_period_start: dateFromUnix(item?.current_period_start || subscription.current_period_start),
      current_period_end: dateFromUnix(item?.current_period_end || subscription.current_period_end),
      cancel_at_period_end: !!subscription.cancel_at_period_end,
      cancel_at: dateFromUnix(subscription.cancel_at),
      canceled_at: dateFromUnix(subscription.canceled_at),
      ended_at: dateFromUnix(subscription.ended_at),
      updated_at: now
    }

    const [row] = await knex('hylo_pro_subscriptions')
      .insert({ ...attrs, created_at: now })
      .onConflict('stripe_subscription_id')
      .merge(attrs)
      .returning('id')

    return HyloProSubscription.where({ id: row.id || row }).fetch({ transacting })
  }
}
