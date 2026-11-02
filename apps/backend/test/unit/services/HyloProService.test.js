/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

/* global HyloProSubscription */

const root = require('root-path')
const Stripe = require('stripe')

// test/setup/core makes every `new Stripe()` return one shared mock client, so stubbing it here
// also stubs the client HyloProService created
const stripeMock = new Stripe('sk_test_fake')
const STUBBED_NAMESPACES = ['products', 'prices', 'subscriptions', 'checkout', 'billingPortal']

const PERIOD_END = 1796181841 // 2026-12-02
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
      expect(row.get('stripe_customer_id')).to.equal('cus_pro_1')
      expect(row.get('stripe_price_id')).to.equal('price_month')
      expect(unix(row.get('current_period_end'))).to.equal(PERIOD_END)
      expect(row.get('cancel_at_period_end')).to.be.false
      expect(await group.hasPro()).to.be.true
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
      const calls = stubRetrieve(subscriptionFixture({ metadata, status: 'past_due' }))

      await HyloProService.handleWebhookEvent({
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        data: { object: { id: 'in_1', object: 'invoice', parent: { type: 'subscription_details', subscription_details: { metadata, subscription: 'sub_pro_1' } } } }
      })

      expect(calls).to.deep.equal(['sub_pro_1'])
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_pro_1' }).fetch()
      expect(row.get('status')).to.equal('past_due')
      expect(await group.hasPro()).to.be.false
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
      expect(created[1][1]).to.include({ unit_amount: 1000, currency: 'usd', lookup_key: 'hylo_pro_monthly_usd' })
      expect(created[2][1]).to.include({ unit_amount: 10000, currency: 'usd', lookup_key: 'hylo_pro_yearly_usd' })

      await HyloProService.ensureProPrices()
      expect(created.length).to.equal(3)
    })

    it('reuses matching prices and replaces one whose amount changed', async () => {
      const created = []
      stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
      stripeMock.prices = {
        list: async () => ({
          data: [
            { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 1000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
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
      expect(created[0]).to.include({ unit_amount: 10000, transfer_lookup_key: true })
    })
  })

  describe('createCheckoutSession', () => {
    it('creates a subscription Checkout on the platform account, tagged for Pro webhooks', async () => {
      stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
      stripeMock.prices = {
        list: async () => ({
          data: [
            { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 1000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
            { id: 'price_y', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 10000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
          ]
        })
      }
      const sessions = []
      stripeMock.checkout = {
        sessions: {
          create: async (params, options) => {
            sessions.push({ params, options })
            return { id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/cs_new' }
          }
        }
      }
      // A lapsed subscription: its customer is reused
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_old' }).save()

      const result = await HyloProService.createCheckoutSession({ group, interval: 'year', userId: 42 })

      expect(result.url).to.equal('https://checkout.stripe.com/c/pay/cs_new')
      expect(sessions.length).to.equal(1)
      const { params, options } = sessions[0]
      expect(options).to.equal(undefined) // no stripeAccount: platform, not Connect
      expect(params.mode).to.equal('subscription')
      expect(params.line_items).to.deep.equal([{ price: 'price_y', quantity: 1 }])
      expect(params.customer).to.equal('cus_old')
      expect(params.subscription_data.metadata).to.deep.equal({ hylo_pro: 'true', group_id: String(group.id) })
      expect(params.metadata).to.include({ hylo_pro: 'true', group_id: String(group.id), user_id: '42' })
      expect(params.success_url).to.match(/\/groups\/.+\/settings\/billing\?checkout=success$/)
      expect(params.cancel_url).to.match(/\/settings\/billing\?checkout=canceled$/)
    })

    it('rejects an unknown interval', async () => {
      await expect(HyloProService.createCheckoutSession({ group, interval: 'week', userId: 1 })).to.be.rejectedWith(/Unknown Hylo Pro interval/)
    })
  })
})
