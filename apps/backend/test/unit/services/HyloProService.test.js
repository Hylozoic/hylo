/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

/* global bookshelf, HyloProSubscription */

const root = require('root-path')
const Stripe = require('stripe')

// test/setup/core makes every `new Stripe()` return one shared mock client, so stubbing it here
// also stubs the client HyloProService created
const stripeMock = new Stripe('sk_test_fake')
const STUBBED_NAMESPACES = ['products', 'prices', 'subscriptions', 'checkout', 'billingPortal', 'customers', 'charges', 'disputes']

const PERIOD_END = 4102444800 // 2100-01-01, so synced rows stay active whatever the real date
const unix = date => Math.floor(date.getTime() / 1000)

// Shaped like a real API 2025-10-29.clover subscription: the period lives on the item
function subscriptionFixture (overrides = {}) {
  return {
    id: 'sub_pro_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_pro_1',
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    metadata: { hylo_pro: 'true', group_id: '0' },
    items: {
      data: [{
        id: 'si_1',
        current_period_end: PERIOD_END,
        price: { id: 'price_month', recurring: { interval: 'month', interval_count: 1 } }
      }]
    },
    ...overrides
  }
}

describe('HyloProService', () => {
  let HyloProService, group, saved

  before(() => {
    HyloProService = require(root('api/services/HyloProService'))
  })

  beforeEach(async () => {
    await setup.clearDb()
    group = await factories.group().save()
    saved = {}
    for (const name of STUBBED_NAMESPACES) saved[name] = stripeMock[name]
    HyloProService.clearCache()
  })

  afterEach(() => {
    for (const name of STUBBED_NAMESPACES) stripeMock[name] = saved[name]
    HyloProService.clearCache()
  })

  after(() => setup.clearDb())

  // Records the customer this database created for the group; syncs only accept its subscriptions
  function recordCustomer (customerId = 'cus_pro_1', groupId = group.id) {
    return bookshelf.knex('hylo_pro_customers').insert({ group_id: groupId, stripe_customer_id: customerId })
  }

  function stubRetrieve (subscription) {
    const calls = []
    stripeMock.subscriptions = {
      retrieve: async id => {
        calls.push(id)
        return subscription
      }
    }
    return calls
  }

  describe('isHyloProEvent', () => {
    const proMetadata = { hylo_pro: 'true', group_id: '1' }

    it('recognizes Pro checkout sessions, subscriptions and invoices on the platform account', () => {
      expect(HyloProService.isHyloProEvent({ type: 'checkout.session.completed', data: { object: { object: 'checkout.session', metadata: proMetadata } } })).to.be.true
      expect(HyloProService.isHyloProEvent({ type: 'customer.subscription.updated', data: { object: { object: 'subscription', metadata: proMetadata } } })).to.be.true
      expect(HyloProService.isHyloProEvent({
        type: 'invoice.paid',
        data: { object: { object: 'invoice', metadata: {}, parent: { type: 'subscription_details', subscription_details: { metadata: proMetadata, subscription: 'sub_1' } } } }
      })).to.be.true
    })

    it('never treats a Connect event as a Pro event', () => {
      expect(HyloProService.isHyloProEvent({ type: 'customer.subscription.updated', account: 'acct_123', data: { object: { metadata: proMetadata } } })).to.be.false
    })

    it('ignores platform events without Pro metadata', () => {
      expect(HyloProService.isHyloProEvent({ type: 'customer.subscription.updated', data: { object: { metadata: { offering_id: '5' } } } })).to.be.false
      expect(HyloProService.isHyloProEvent({ type: 'invoice.paid', data: { object: { parent: null } } })).to.be.false
      expect(HyloProService.isHyloProEvent({ type: 'charge.refunded', data: { object: {} } })).to.be.false
    })
  })

  describe('handleWebhookEvent', () => {
    beforeEach(() => recordCustomer())

    it('creates the row from the subscription after checkout completes', async () => {
      const calls = stubRetrieve(subscriptionFixture({ metadata: { hylo_pro: 'true', group_id: String(group.id) } }))

      await HyloProService.handleWebhookEvent({
        id: 'evt_checkout',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1', object: 'checkout.session', mode: 'subscription', subscription: 'sub_pro_1', metadata: { hylo_pro: 'true', group_id: String(group.id) } } }
      })

      expect(calls).to.deep.equal(['sub_pro_1'])
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('group_id')).to.equal(group.id)
      expect(row.get('source')).to.equal('stripe')
      expect(row.get('status')).to.equal('active')
      expect(row.get('interval')).to.equal('month')
      expect(row.get('tier')).to.equal('pro')
      expect(row.get('stripe_customer_id')).to.equal('cus_pro_1')
      expect(row.get('stripe_price_id')).to.equal('price_month')
      expect(unix(row.get('current_period_end'))).to.equal(PERIOD_END)
      expect(row.get('cancel_at_period_end')).to.be.false
      expect(await group.hasPro()).to.be.true
      expect(await group.hasProFeature('designedViews')).to.be.true
      expect(await group.hasProFeature('recording')).to.be.false
    })

    it('maps the price lookup key to the tier, treating unknown prices as Pro', () => {
      expect(HyloProService.tierForPrice({ lookup_key: 'hylo_pro_monthly_usd' })).to.equal('pro')
      expect(HyloProService.tierForPrice({ lookup_key: 'hylo_pro_yearly_usd' })).to.equal('pro')
      expect(HyloProService.tierForPrice({ lookup_key: 'something_else' })).to.equal('pro')
      expect(HyloProService.tierForPrice(null)).to.equal('pro')
    })

    it('applies the latest subscription state on later events, updating the same row', async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      stubRetrieve(subscriptionFixture({ metadata }))
      await HyloProService.handleWebhookEvent({ id: 'evt_1', type: 'customer.subscription.created', data: { object: subscriptionFixture({ metadata }) } })

      // Cancelled in the portal: Stripe keeps it active until the period ends
      stubRetrieve(subscriptionFixture({ metadata, cancel_at_period_end: true, cancel_at: PERIOD_END, canceled_at: PERIOD_END - 1000 }))
      await HyloProService.handleWebhookEvent({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: subscriptionFixture({ metadata }) } })

      let rows = await HyloProSubscription.where({ group_id: group.id }).fetchAll()
      expect(rows.length).to.equal(1)
      expect(rows.first().get('cancel_at_period_end')).to.be.true
      expect(unix(rows.first().get('cancel_at'))).to.equal(PERIOD_END)
      expect(await group.hasPro()).to.be.true

      // Period over
      stubRetrieve(subscriptionFixture({ metadata, status: 'canceled', cancel_at_period_end: true, cancel_at: PERIOD_END, ended_at: PERIOD_END }))
      await HyloProService.handleWebhookEvent({ id: 'evt_3', type: 'customer.subscription.deleted', data: { object: subscriptionFixture({ metadata }) } })

      rows = await HyloProSubscription.where({ group_id: group.id }).fetchAll()
      expect(rows.length).to.equal(1)
      expect(rows.first().get('status')).to.equal('canceled')
      expect(unix(rows.first().get('ended_at'))).to.equal(PERIOD_END)
      expect(await group.hasPro()).to.be.false
    })

    it('re-reads the subscription instead of trusting an out-of-order payload', async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      stubRetrieve(subscriptionFixture({ metadata, status: 'canceled', ended_at: PERIOD_END - 10 }))

      // A stale "active" payload delivered after the deletion
      await HyloProService.handleWebhookEvent({ id: 'evt_stale', type: 'customer.subscription.updated', data: { object: subscriptionFixture({ metadata, status: 'active' }) } })

      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('status')).to.equal('canceled')
    })

    it('syncs a monthly-to-yearly switch from the portal', async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      stubRetrieve(subscriptionFixture({
        metadata,
        items: { data: [{ id: 'si_1', current_period_end: PERIOD_END, price: { id: 'price_year', recurring: { interval: 'year', interval_count: 1 } } }] }
      }))
      await HyloProService.handleWebhookEvent({ id: 'evt_switch', type: 'customer.subscription.updated', data: { object: subscriptionFixture({ metadata }) } })

      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('interval')).to.equal('year')
      expect(row.get('stripe_price_id')).to.equal('price_year')
    })

    it('syncs from invoice events using the subscription in invoice.parent', async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      // The renewal was billed (and failed) a day ago
      const renewedAt = unix(new Date()) - 24 * 60 * 60
      const calls = stubRetrieve(subscriptionFixture({
        metadata,
        status: 'past_due',
        items: { data: [{ id: 'si_1', current_period_start: renewedAt, current_period_end: PERIOD_END, price: { id: 'price_month', recurring: { interval: 'month', interval_count: 1 } } }] }
      }))

      await HyloProService.handleWebhookEvent({
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        data: { object: { id: 'in_1', object: 'invoice', parent: { type: 'subscription_details', subscription_details: { metadata, subscription: 'sub_pro_1' } } } }
      })

      expect(calls).to.deep.equal(['sub_pro_1'])
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('status')).to.equal('past_due')
      expect(unix(row.get('current_period_start'))).to.equal(renewedAt)
      // Pro stays on during the grace period while Stripe retries the payment
      expect(await group.hasPro()).to.be.true
      expect(await group.hasPro()).to.equal(row.isActive())
    })

    it('ignores event types that cannot change the subscription', async () => {
      const calls = stubRetrieve(subscriptionFixture())
      const result = await HyloProService.handleWebhookEvent({
        id: 'evt_created',
        type: 'invoice.created',
        data: { object: { id: 'in_1', parent: { subscription_details: { metadata: { hylo_pro: 'true' }, subscription: 'sub_pro_1' } } } }
      })
      expect(result).to.equal(null)
      expect(calls).to.deep.equal([])
    })

    it('ignores one-time checkout sessions', async () => {
      const calls = stubRetrieve(subscriptionFixture())
      const result = await HyloProService.handleWebhookEvent({
        id: 'evt_payment',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_2', mode: 'payment', metadata: { hylo_pro: 'true' } } }
      })
      expect(result).to.equal(null)
      expect(calls).to.deep.equal([])
    })

    it('acknowledges subscriptions for groups that no longer exist without creating a row', async () => {
      stubRetrieve(subscriptionFixture({ metadata: { hylo_pro: 'true', group_id: '999999999' } }))
      const result = await HyloProService.handleWebhookEvent({ id: 'evt_gone', type: 'customer.subscription.updated', data: { object: subscriptionFixture() } })
      expect(result).to.equal(null)
      expect(await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()).to.equal(null)
    })

    it("ignores a subscription whose customer isn't the group's recorded customer", async () => {
      stubRetrieve(subscriptionFixture({ customer: 'cus_other_env', metadata: { hylo_pro: 'true', group_id: String(group.id) } }))
      const result = await HyloProService.handleWebhookEvent({ id: 'evt_other_env', type: 'customer.subscription.updated', data: { object: subscriptionFixture() } })
      expect(result).to.equal(null)
      expect(await HyloProSubscription.where({ group_id: group.id }).fetch()).to.equal(null)
      expect(await group.hasPro()).to.be.false
    })

    it('ignores a subscription for a group that has no customer here', async () => {
      const other = await factories.group().save()
      stubRetrieve(subscriptionFixture({ metadata: { hylo_pro: 'true', group_id: String(other.id) } }))
      const result = await HyloProService.handleWebhookEvent({ id: 'evt_no_customer', type: 'customer.subscription.updated', data: { object: subscriptionFixture() } })
      expect(result).to.equal(null)
      expect(await HyloProSubscription.where({ group_id: other.id }).fetch()).to.equal(null)
    })
  })

  describe('ensureProPrices', () => {
    it('creates the product and both prices when missing, then reuses the cached ids', async () => {
      const created = []
      stripeMock.products = {
        retrieve: async () => {
          const error = new Error('No such product')
          error.code = 'resource_missing'
          throw error
        },
        create: async params => {
          created.push(['product', params])
          return { id: params.id, active: true }
        }
      }
      stripeMock.prices = {
        list: async () => ({ data: [] }),
        create: async params => {
          created.push(['price', params])
          return { id: `price_${params.recurring.interval}` }
        }
      }

      const ids = await HyloProService.ensureProPrices()
      expect(ids).to.deep.equal({ month: 'price_month', year: 'price_year' })
      expect(created.map(([kind]) => kind)).to.deep.equal(['product', 'price', 'price'])
      expect(created[0][1].id).to.equal('hylo_pro')
      expect(created[1][1]).to.include({ unit_amount: 6000, currency: 'usd', lookup_key: 'hylo_pro_monthly_usd' })
      expect(created[2][1]).to.include({ unit_amount: 60000, currency: 'usd', lookup_key: 'hylo_pro_yearly_usd' })

      await HyloProService.ensureProPrices()
      expect(created.length).to.equal(3)
    })

    it('reuses matching prices and replaces one whose amount changed', async () => {
      const created = []
      stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
      stripeMock.prices = {
        list: async () => ({
          data: [
            { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 6000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
            { id: 'price_y_old', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 9000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
          ]
        }),
        create: async params => {
          created.push(params)
          return { id: 'price_y_new' }
        }
      }

      const ids = await HyloProService.ensureProPrices()
      expect(ids).to.deep.equal({ month: 'price_m', year: 'price_y_new' })
      expect(created.length).to.equal(1)
      expect(created[0]).to.include({ unit_amount: 60000, transfer_lookup_key: true })
    })
  })

  describe('ensurePortalConfiguration', () => {
    const PRICES = [
      { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 6000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
      { id: 'price_y', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 60000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
    ]

    function stubPortal (features) {
      const updates = []
      stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
      stripeMock.prices = { list: async () => ({ data: PRICES }) }
      stripeMock.billingPortal = {
        configurations: {
          list: async () => ({ data: [{ id: 'bpc_pro', metadata: { hylo_pro_portal: 'true' }, features }] }),
          update: async (id, params) => {
            updates.push(params.features)
            return { id }
          }
        }
      }
      return updates
    }

    const wantedFeatures = () => ({
      customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [{ product: 'hylo_pro', prices: ['price_y', 'price_m'] }]
      }
    })

    it('leaves a configuration that already matches alone', async () => {
      const updates = stubPortal(wantedFeatures())
      expect(await HyloProService.ensurePortalConfiguration()).to.equal('bpc_pro')
      expect(updates).to.deep.equal([])
    })

    it('updates a configuration whose features changed, not only its prices', async () => {
      const features = wantedFeatures()
      features.subscription_cancel.mode = 'immediately'
      const updates = stubPortal(features)
      expect(await HyloProService.ensurePortalConfiguration()).to.equal('bpc_pro')
      expect(updates.length).to.equal(1)
      expect(updates[0].subscription_cancel.mode).to.equal('at_period_end')
    })
  })

  describe('createCheckoutSession', () => {
    const PRICES = [
      { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 6000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
      { id: 'price_y', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 60000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
    ]
    let calls, stripeSubscriptions, openSessions

    // A fake Stripe: subscriptions and open Checkout sessions per customer, recording every call
    beforeEach(() => {
      calls = { customersCreated: [], sessionsCreated: [], sessionsExpired: [], subscriptionsListed: [] }
      stripeSubscriptions = []
      openSessions = []
      stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
      stripeMock.prices = { list: async () => ({ data: PRICES }) }
      stripeMock.customers = {
        create: async (params, options) => {
          calls.customersCreated.push({ params, options })
          return { id: 'cus_new' }
        }
      }
      stripeMock.subscriptions = {
        list: async params => {
          calls.subscriptionsListed.push(params)
          return { data: stripeSubscriptions.filter(sub => sub.customer === params.customer) }
        },
        retrieve: async id => stripeSubscriptions.find(sub => sub.id === id)
      }
      stripeMock.checkout = {
        sessions: {
          list: async params => {
            // Stripe answers over the network; let concurrent calls interleave
            await new Promise(resolve => setTimeout(resolve, 20))
            return { data: openSessions.filter(session => session.customer === params.customer) }
          },
          expire: async id => {
            calls.sessionsExpired.push(id)
            openSessions = openSessions.filter(session => session.id !== id)
          },
          create: async (params, options) => {
            calls.sessionsCreated.push({ params, options })
            const session = { id: `cs_${calls.sessionsCreated.length}`, url: `https://checkout.stripe.com/c/pay/cs_${calls.sessionsCreated.length}`, customer: params.customer, metadata: params.metadata }
            openSessions.push(session)
            return session
          }
        }
      }
    })

    const proMetadata = () => ({ hylo_pro: 'true', group_id: String(group.id) })

    it('creates a subscription Checkout on the platform account, tagged for Pro webhooks', async () => {
      // The group subscribed before: its customer is reused
      await recordCustomer('cus_old')
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_old' }).save()

      const result = await HyloProService.createCheckoutSession({ group, interval: 'year', userId: 42 })

      expect(result).to.deep.equal({ url: 'https://checkout.stripe.com/c/pay/cs_1', sessionId: 'cs_1' })
      expect(calls.customersCreated).to.deep.equal([])
      expect(calls.subscriptionsListed).to.deep.equal([{ customer: 'cus_old', status: 'all', limit: 100 }])
      expect(calls.sessionsCreated.length).to.equal(1)
      const { params, options } = calls.sessionsCreated[0]
      expect(options).to.equal(undefined) // no stripeAccount: platform, not Connect
      expect(params.mode).to.equal('subscription')
      expect(params.line_items).to.deep.equal([{ price: 'price_y', quantity: 1 }])
      expect(params.customer).to.equal('cus_old')
      expect(params.subscription_data.metadata).to.deep.equal(proMetadata())
      expect(params.metadata).to.include({ ...proMetadata(), interval: 'year', user_id: '42' })
      expect(params.success_url).to.match(/\/groups\/.+\/settings\/billing\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}$/)
      expect(params.cancel_url).to.match(/\/settings\/billing\?checkout=canceled$/)
      expect(await HyloProService.stripeCustomerIdForGroup(group.id)).to.equal('cus_old')
    })

    it("creates and records the group's customer on its first Checkout, then keeps using it", async () => {
      await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 })

      expect(calls.customersCreated.length).to.equal(1)
      expect(calls.customersCreated[0].params.metadata).to.deep.equal(proMetadata())
      expect(calls.sessionsCreated[0].params.customer).to.equal('cus_new')
      expect(await HyloProService.stripeCustomerIdForGroup(group.id)).to.equal('cus_new')

      await HyloProService.createCheckoutSession({ group, interval: 'year', userId: 1 })
      expect(calls.customersCreated.length).to.equal(1)
      expect(calls.sessionsCreated[1].params.customer).to.equal('cus_new')
    })

    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) {
      it(`refuses while Stripe has a ${status} subscription we haven't heard about, and syncs it`, async () => {
        await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_g' })
        stripeSubscriptions.push(subscriptionFixture({ id: 'sub_unsynced', customer: 'cus_g', status, metadata: proMetadata() }))

        await expect(HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 }))
          .to.be.rejectedWith(/already has a Hylo Pro subscription/)

        expect(calls.sessionsCreated).to.deep.equal([])
        const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_unsynced' }).fetch()
        expect(row.get('status')).to.equal(status)
      })
    }

    it("re-syncs our rows that still look open when Stripe has nothing open, so a stale row can't block Checkout", async () => {
      await recordCustomer('cus_g')
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_stale', stripe_customer_id: 'cus_g', current_period_end: new Date(PERIOD_END * 1000) }).save()
      // The deletion webhook never arrived
      stripeSubscriptions.push(subscriptionFixture({ id: 'sub_stale', customer: 'cus_g', status: 'canceled', ended_at: PERIOD_END - 1000, metadata: proMetadata() }))

      const result = await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 })

      expect(result.sessionId).to.equal('cs_1')
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_stale' }).fetch()
      expect(row.get('status')).to.equal('canceled')
    })

    it('allows a new Checkout when our open-looking row no longer exists in Stripe at all', async () => {
      await recordCustomer('cus_g')
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_deleted', stripe_customer_id: 'cus_g', current_period_end: new Date(PERIOD_END * 1000) }).save()
      const retrieved = []
      stripeMock.subscriptions.retrieve = async id => {
        retrieved.push(id)
        const error = new Error('No such subscription')
        error.code = 'resource_missing'
        throw error
      }

      const result = await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 })
      expect(retrieved).to.deep.equal(['sub_deleted'])
      expect(result.sessionId).to.equal('cs_1')
    })

    it('allows a new Checkout when every Stripe subscription is over', async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_g' })
      stripeSubscriptions.push(subscriptionFixture({ id: 'sub_a', customer: 'cus_g', status: 'canceled', metadata: proMetadata() }))
      stripeSubscriptions.push(subscriptionFixture({ id: 'sub_b', customer: 'cus_g', status: 'incomplete_expired', metadata: proMetadata() }))

      const result = await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 })
      expect(result.sessionId).to.equal('cs_1')
    })

    it('reuses an open Checkout for the same interval and expires one for the other interval', async () => {
      const first = await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 })
      const again = await HyloProService.createCheckoutSession({ group, interval: 'month', userId: 2 })
      expect(again).to.deep.equal(first)
      expect(calls.sessionsCreated.length).to.equal(1)

      const yearly = await HyloProService.createCheckoutSession({ group, interval: 'year', userId: 1 })
      expect(calls.sessionsExpired).to.deep.equal([first.sessionId])
      expect(yearly.sessionId).to.equal('cs_2')
      expect(openSessions.map(session => session.id)).to.deep.equal(['cs_2'])
    })

    it('creates only one Checkout when two stewards click at the same time', async () => {
      const results = await Promise.all([
        HyloProService.createCheckoutSession({ group, interval: 'month', userId: 1 }),
        HyloProService.createCheckoutSession({ group, interval: 'month', userId: 2 })
      ])

      expect(calls.customersCreated.length).to.equal(1)
      expect(calls.sessionsCreated.length).to.equal(1)
      expect(results[1]).to.deep.equal(results[0])
    })

    it('rejects an unknown interval', async () => {
      await expect(HyloProService.createCheckoutSession({ group, interval: 'week', userId: 1 })).to.be.rejectedWith(/Unknown Hylo Pro interval/)
    })
  })

  describe('activateCheckoutSession', () => {
    beforeEach(() => recordCustomer())

    function stubSession (session) {
      stripeMock.checkout = { sessions: { retrieve: async () => session } }
    }

    it("syncs the session's subscription without waiting for the webhook", async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      stubSession({ id: 'cs_done', mode: 'subscription', subscription: 'sub_pro_1', metadata })
      const calls = stubRetrieve(subscriptionFixture({ metadata }))

      const row = await HyloProService.activateCheckoutSession({ group, sessionId: 'cs_done' })

      expect(calls).to.deep.equal(['sub_pro_1'])
      expect(row.get('group_id')).to.equal(group.id)
      expect(row.isActive()).to.be.true
      expect(await group.hasPro()).to.be.true
    })

    it("rejects another group's session", async () => {
      const other = await factories.group().save()
      stubSession({ id: 'cs_other', mode: 'subscription', subscription: 'sub_x', metadata: { hylo_pro: 'true', group_id: String(other.id) } })
      const calls = stubRetrieve(subscriptionFixture())

      await expect(HyloProService.activateCheckoutSession({ group, sessionId: 'cs_other' }))
        .to.be.rejectedWith(/not a Hylo Pro checkout for this group/)
      expect(calls).to.deep.equal([])
    })

    it('rejects a session that is not a Pro checkout', async () => {
      stubSession({ id: 'cs_connect', mode: 'subscription', subscription: 'sub_x', metadata: { group_id: String(group.id) } })
      await expect(HyloProService.activateCheckoutSession({ group, sessionId: 'cs_connect' }))
        .to.be.rejectedWith(/not a Hylo Pro checkout/)
    })

    it('returns null while the session has no subscription yet', async () => {
      stubSession({ id: 'cs_open', mode: 'subscription', subscription: null, metadata: { hylo_pro: 'true', group_id: String(group.id) } })
      expect(await HyloProService.activateCheckoutSession({ group, sessionId: 'cs_open' })).to.equal(null)
    })
  })

  describe('handleChargeEvent', () => {
    function charge (overrides = {}) {
      return {
        id: 'ch_pro_1',
        object: 'charge',
        customer: 'cus_pro_1',
        amount: 1000,
        amount_refunded: 1000,
        currency: 'usd',
        refunded: true,
        refunds: { data: [{ id: 're_2', reason: 'requested_by_customer' }, { id: 're_1', reason: null }] },
        ...overrides
      }
    }

    function stubCharge (value) {
      const calls = []
      stripeMock.charges = { retrieve: async (id, params) => { calls.push({ id, params }); return value } }
      return calls
    }

    function stubDispute (value) {
      const calls = []
      stripeMock.disputes = { retrieve: async (id, params) => { calls.push({ id, params }); return value } }
      return calls
    }

    const proLogs = () => bookshelf.knex('stripe_logs').whereIn('log_type', ['hylo_pro_refund', 'hylo_pro_dispute']).orderBy('id')

    it('records a refund of a Pro payment from the charge re-read in Stripe, one row per charge', async () => {
      await recordCustomer()
      const calls = stubCharge(charge({ amount_refunded: 400, refunded: false, refunds: { data: [{ id: 're_1', reason: 'duplicate' }] } }))
      // The payload is stale; the re-read charge decides
      const event = { id: 'evt_r1', type: 'charge.refunded', data: { object: charge({ amount_refunded: 1 }) } }

      await HyloProService.handleChargeEvent(event)
      stubCharge(charge())
      const row = await HyloProService.handleChargeEvent({ ...event, id: 'evt_r2' })

      expect(calls[0]).to.deep.equal({ id: 'ch_pro_1', params: { expand: ['refunds'] } })
      const rows = await proLogs()
      expect(rows.length).to.equal(1)
      expect(rows[0].id).to.equal(row.id)
      expect(rows[0]).to.include({
        group_id: group.id,
        stripe_account_id: null,
        log_type: 'hylo_pro_refund',
        external_id: 'ch_pro_1',
        charge_id: 'ch_pro_1',
        amount: 1000,
        currency: 'usd',
        reason: 'requested_by_customer',
        status: 'refunded'
      })
      expect(rows[0].metadata).to.deep.equal({ stripe_customer_id: 'cus_pro_1', charge_amount: 1000, refund_ids: ['re_2', 're_1'] })
    })

    it('ignores a refund by a customer that is not a Pro customer, without calling Stripe', async () => {
      await recordCustomer()
      const calls = stubCharge(charge())
      const result = await HyloProService.handleChargeEvent({ id: 'evt_r', type: 'charge.refunded', data: { object: charge({ customer: 'cus_other' }) } })
      expect(result).to.equal(null)
      expect(calls).to.deep.equal([])
      expect(await proLogs()).to.deep.equal([])
    })

    it('records a dispute of a Pro payment and keeps it up to date', async () => {
      await recordCustomer()
      const dispute = (overrides = {}) => ({
        id: 'dp_1', object: 'dispute', charge: charge(), amount: 1000, currency: 'usd', reason: 'fraudulent', status: 'needs_response', ...overrides
      })
      const calls = stubDispute(dispute())
      await HyloProService.handleChargeEvent({ id: 'evt_d1', type: 'charge.dispute.created', data: { object: { id: 'dp_1', charge: 'ch_pro_1' } } })
      stubDispute(dispute({ status: 'lost' }))
      await HyloProService.handleChargeEvent({ id: 'evt_d2', type: 'charge.dispute.closed', data: { object: { id: 'dp_1', charge: 'ch_pro_1' } } })

      expect(calls[0]).to.deep.equal({ id: 'dp_1', params: { expand: ['charge'] } })
      const rows = await proLogs()
      expect(rows.length).to.equal(1)
      expect(rows[0]).to.include({
        group_id: group.id,
        log_type: 'hylo_pro_dispute',
        external_id: 'dp_1',
        charge_id: 'ch_pro_1',
        amount: 1000,
        reason: 'fraudulent',
        status: 'lost'
      })
    })

    it('ignores disputes of other platform payments and every Connect event', async () => {
      await recordCustomer()
      stubDispute({ id: 'dp_2', charge: charge({ customer: 'cus_other' }), amount: 5, status: 'needs_response' })
      expect(await HyloProService.handleChargeEvent({ id: 'evt_d', type: 'charge.dispute.created', data: { object: { id: 'dp_2' } } })).to.equal(null)

      const calls = stubCharge(charge())
      expect(HyloProService.isChargeEvent({ type: 'charge.refunded', account: 'acct_1', data: { object: charge() } })).to.be.false
      expect(await HyloProService.handleChargeEvent({ id: 'evt_c', type: 'charge.refunded', account: 'acct_1', data: { object: charge() } })).to.equal(null)
      expect(HyloProService.isChargeEvent({ type: 'charge.succeeded', data: { object: charge() } })).to.be.false
      expect(calls).to.deep.equal([])
      expect(await proLogs()).to.deep.equal([])
    })

    it('leaves Connect refund and dispute counts alone', async () => {
      await recordCustomer()
      stubCharge(charge())
      await HyloProService.handleChargeEvent({ id: 'evt_r', type: 'charge.refunded', data: { object: charge() } })
      const connectRows = await bookshelf.knex('stripe_logs').where({ group_id: group.id }).whereIn('log_type', ['refund', 'dispute'])
      expect(connectRows).to.deep.equal([])
    })
  })

  describe('resyncSubscriptions', () => {
    let listCalls, retrieveCalls, stripeSubscriptions

    // Every customer below has id % 24 equal to its slot only if ids are known, so tests use slots: 1
    function stubStripe () {
      listCalls = []
      retrieveCalls = []
      stripeMock.subscriptions = {
        list: async params => {
          listCalls.push(params)
          return { data: stripeSubscriptions.filter(sub => sub.customer === params.customer), has_more: false }
        },
        retrieve: async id => {
          retrieveCalls.push(id)
          const sub = stripeSubscriptions.find(s => s.id === id)
          if (!sub) {
            const error = new Error('No such subscription')
            error.code = 'resource_missing'
            throw error
          }
          return sub
        }
      }
    }

    beforeEach(() => {
      stripeSubscriptions = []
      stubStripe()
    })

    const metadataFor = g => ({ hylo_pro: 'true', group_id: String(g.id) })

    it('syncs a subscription whose webhooks were missed, and a change to one we have', async () => {
      await recordCustomer()
      stripeSubscriptions = [
        subscriptionFixture({ id: 'sub_missed', metadata: metadataFor(group) }),
        subscriptionFixture({ id: 'sub_known', metadata: metadataFor(group), status: 'past_due' })
      ]
      await bookshelf.knex('hylo_pro_subscriptions').insert({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_known', stripe_customer_id: 'cus_pro_1' })

      const result = await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })

      expect(result).to.deep.equal({ customers: 1, synced: 2, failed: 0, rateLimited: false })
      expect(listCalls).to.deep.equal([{ customer: 'cus_pro_1', status: 'all', limit: 100 }])
      expect((await HyloProSubscription.where({ stripe_subscription_id: 'sub_missed' }).fetch()).get('status')).to.equal('active')
      expect((await HyloProSubscription.where({ stripe_subscription_id: 'sub_known' }).fetch()).get('status')).to.equal('past_due')
    })

    it('is idempotent and skips subscriptions already recorded as over', async () => {
      await recordCustomer()
      stripeSubscriptions = [
        subscriptionFixture({ id: 'sub_over', metadata: metadataFor(group), status: 'canceled', ended_at: 1000 }),
        subscriptionFixture({ id: 'sub_live', metadata: metadataFor(group) })
      ]
      await bookshelf.knex('hylo_pro_subscriptions').insert({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_over', stripe_customer_id: 'cus_pro_1' })

      await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })
      const before = await bookshelf.knex('hylo_pro_subscriptions').orderBy('id').select('stripe_subscription_id', 'status')
      retrieveCalls = []
      await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })
      const after = await bookshelf.knex('hylo_pro_subscriptions').orderBy('id').select('stripe_subscription_id', 'status')

      expect(retrieveCalls).to.deep.equal(['sub_live'])
      expect(after).to.deep.equal(before)
      expect(after.length).to.equal(2)
    })

    it('checks our open rows that Stripe no longer lists, and ignores non-Pro subscriptions', async () => {
      await recordCustomer()
      stripeSubscriptions = [subscriptionFixture({ id: 'sub_not_pro', metadata: {} })]
      await bookshelf.knex('hylo_pro_subscriptions').insert({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_gone', stripe_customer_id: 'cus_pro_1' })

      const result = await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })

      expect(retrieveCalls).to.deep.equal(['sub_gone'])
      expect(result).to.include({ synced: 0, failed: 0 })
    })

    it('only takes the groups in its slot', async () => {
      const other = await factories.group().save()
      await recordCustomer('cus_pro_1', group.id)
      await recordCustomer('cus_pro_2', other.id)
      const rows = await bookshelf.knex('hylo_pro_customers').orderBy('id').select('id', 'stripe_customer_id')

      for (const row of rows) {
        listCalls = []
        await HyloProService.resyncSubscriptions({ slot: Number(row.id) % 24 })
        expect(listCalls.map(c => c.customer)).to.include(row.stripe_customer_id)
        const otherRow = rows.find(r => r !== row)
        if (Number(otherRow.id) % 24 !== Number(row.id) % 24) {
          expect(listCalls.map(c => c.customer)).to.not.include(otherRow.stripe_customer_id)
        }
      }
    })

    it('goes on after one group fails, and stops at a Stripe rate limit', async () => {
      const other = await factories.group().save()
      await recordCustomer('cus_pro_1', group.id)
      await recordCustomer('cus_pro_2', other.id)
      const listed = []
      stripeMock.subscriptions = {
        list: async params => {
          listed.push(params.customer)
          throw new Error('stripe down')
        }
      }
      expect(await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })).to.deep.equal({ customers: 2, synced: 0, failed: 2, rateLimited: false })
      expect(listed).to.deep.equal(['cus_pro_1', 'cus_pro_2'])

      listed.length = 0
      stripeMock.subscriptions = {
        list: async params => {
          listed.push(params.customer)
          const error = new Error('Too many requests')
          error.type = 'StripeRateLimitError'
          throw error
        }
      }
      expect(await HyloProService.resyncSubscriptions({ slot: 0, slots: 1 })).to.deep.equal({ customers: 2, synced: 0, failed: 0, rateLimited: true })
      expect(listed).to.deep.equal(['cus_pro_1'])
    })

    it('rejects a slot outside the range', async () => {
      await expect(HyloProService.resyncSubscriptions({ slot: 24 })).to.be.rejectedWith(/slot/)
      await expect(HyloProService.resyncSubscriptions({})).to.be.rejectedWith(/slot/)
    })
  })

  describe('syncSubscriptionById', () => {
    it('never lets an older snapshot overwrite a newer one when two syncs overlap', async () => {
      await recordCustomer()
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      // Stripe's state changes between the two reads; the first read answers slowly
      const snapshots = [
        { delay: 150, subscription: subscriptionFixture({ metadata, status: 'active' }) },
        { delay: 0, subscription: subscriptionFixture({ metadata, status: 'past_due' }) }
      ]
      let reads = 0
      stripeMock.subscriptions = {
        retrieve: async () => {
          const { delay, subscription } = snapshots[Math.min(reads++, snapshots.length - 1)]
          await new Promise(resolve => setTimeout(resolve, delay))
          return subscription
        }
      }

      const first = HyloProService.syncSubscriptionById('sub_pro_1')
      await new Promise(resolve => setTimeout(resolve, 30))
      const second = HyloProService.syncSubscriptionById('sub_pro_1')
      await Promise.all([first, second])

      expect(reads).to.equal(2)
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('status')).to.equal('past_due')
    })
  })
})
