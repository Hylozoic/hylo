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
 *   out-of-order events always leave the latest state.
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

// Error code for "this group already has a subscription"; the web shows its own translated message
const ALREADY_SUBSCRIBED = 'HYLO_PRO_ALREADY_SUBSCRIBED'

function alreadySubscribedError () {
  return new GraphQLError('This group already has a Hylo Pro subscription. Use Manage subscription to change it.', {
    extensions: { code: ALREADY_SUBSCRIBED }
  })
}

/**
 * Runs fn in a transaction holding a Postgres advisory lock on `key`, so callers using the same key
 * run one at a time (across all backend processes). The lock is released when the transaction ends.
 */
function withLock (key, fn) {
  return bookshelf.transaction(async trx => {
    await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [key])
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

function billingUrl (group) {
  return `${Frontend.Route.groupSettings(group)}/billing`
}

module.exports = {
  PRODUCT_ID,
  PLANS,
  INTERVALS,
  CURRENCY,
  ALREADY_SUBSCRIBED,
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
      const configuredPrices = (existing.features?.subscription_update?.products || [])
        .flatMap(p => p.prices || [])
        .sort()
      const wantedPrices = [priceIds.month, priceIds.year].sort()
      configuration = configuredPrices.join() === wantedPrices.join()
        ? existing
        : await stripe.billingPortal.configurations.update(existing.id, { features })
    }

    cachedPortalConfigurationId = configuration.id
    return configuration.id
  },

  /**
   * The platform customer this group pays with, or null if it never started a Checkout.
   * Groups that subscribed before hylo_pro_customers existed fall back to their latest subscription's customer.
   */
  async stripeCustomerIdForGroup (groupId) {
    const row = await bookshelf.knex('hylo_pro_customers').where({ group_id: groupId }).first('stripe_customer_id')
    if (row) return row.stripe_customer_id
    return HyloProSubscription.latestStripeCustomerId(groupId)
  },

  /**
   * Returns the group's platform customer, creating and recording it on first use.
   * Call it while holding the group's checkout lock (see createCheckoutSession).
   */
  async ensureCustomer (group) {
    const existing = await this.stripeCustomerIdForGroup(group.id)
    let customerId = existing
    if (!customerId) {
      // No idempotency key: group ids repeat across databases sharing a Stripe account (dev,
      // staging), so a key per group could hand one group another's customer. Callers hold the
      // group's checkout lock, so two customers can't be created for one group at once.
      const customer = await stripe.customers.create({
        name: group.get('name'),
        metadata: { [PRO_METADATA_KEY]: 'true', group_id: String(group.id) }
      })
      customerId = customer.id
    }
    const now = new Date()
    await bookshelf.knex('hylo_pro_customers')
      .insert({ group_id: group.id, stripe_customer_id: customerId, created_at: now, updated_at: now })
      .onConflict('group_id')
      .ignore()
    // Another request may have recorded a customer first; always use the recorded one
    const row = await bookshelf.knex('hylo_pro_customers').where({ group_id: group.id }).first('stripe_customer_id')
    return row.stripe_customer_id
  },

  /**
   * Starts a Stripe-hosted Checkout for a group to subscribe to Hylo Pro.
   *
   * Runs under a per-group lock. Throws alreadySubscribedError() if the group's customer has a
   * subscription in Stripe that isn't over (anything but canceled / incomplete_expired) — those are
   * synced into our table first, covering a webhook that hasn't arrived yet. An open Checkout for
   * the same interval is returned instead of creating another; one for the other interval is
   * expired, so only one Checkout for the group can ever be completed.
   *
   * @returns {Promise<{ url: string, sessionId: string }>}
   */
  async createCheckoutSession ({ group, interval, userId }) {
    if (!INTERVALS.includes(interval)) {
      throw new Error(`Unknown Hylo Pro interval: ${interval}`)
    }

    return withLock(`hylo_pro_checkout:${group.id}`, async () => {
      const priceIds = await this.ensureProPrices()
      const customerId = await this.ensureCustomer(group)

      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
      const open = subscriptions.data.filter(sub => !HyloProSubscription.TERMINAL_STRIPE_STATUSES.includes(sub.status))
      if (open.length > 0) {
        for (const sub of open) await this.syncSubscriptionById(sub.id)
        throw alreadySubscribedError()
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
   * Re-reads a subscription from Stripe and upserts its row. Holds a lock on the subscription id
   * from before the read until the write commits, so when two syncs overlap the later one reads
   * Stripe after the earlier one has written — an older snapshot can never overwrite a newer one.
   *
   * @returns {Promise<HyloProSubscription|null>}
   */
  async syncSubscriptionById (subscriptionId) {
    return withLock(`hylo_pro_subscription:${subscriptionId}`, async trx => {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      return this.syncSubscription(subscription, { transacting: trx })
    })
  },

  /**
   * Upserts the hylo_pro_subscriptions row for a Stripe subscription object. Use syncSubscriptionById
   * unless the caller holds that subscription's lock and has just read it from Stripe.
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

    const item = subscription.items?.data?.[0]
    const price = item?.price
    const now = new Date()
    const attrs = {
      group_id: group.id,
      source: HyloProSubscription.SOURCE_STRIPE,
      status: subscription.status,
      interval: price?.recurring?.interval || null,
      stripe_customer_id: idOf(subscription.customer),
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id || null,
      // Since API 2025-03-31 the billing period lives on the subscription item
      current_period_end: dateFromUnix(item?.current_period_end || subscription.current_period_end),
      cancel_at_period_end: !!subscription.cancel_at_period_end,
      cancel_at: dateFromUnix(subscription.cancel_at),
      canceled_at: dateFromUnix(subscription.canceled_at),
      ended_at: dateFromUnix(subscription.ended_at),
      updated_at: now
    }

    const knex = transacting || bookshelf.knex
    const [row] = await knex('hylo_pro_subscriptions')
      .insert({ ...attrs, created_at: now })
      .onConflict('stripe_subscription_id')
      .merge(attrs)
      .returning('id')

    return HyloProSubscription.where({ id: row.id || row }).fetch({ transacting })
  }
}
