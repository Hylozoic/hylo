/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import HyloProService from '../../services/HyloProService'
import { createHyloProCheckoutSession, createHyloProPortalSession } from './hyloPro'

/* global HyloProSubscription */

const Stripe = require('stripe')

// test/setup/core makes every `new Stripe()` return this one shared mock client
const stripeMock = new Stripe('sk_test_fake')
const STUBBED_NAMESPACES = ['products', 'prices', 'checkout', 'billingPortal']

const PRICES = [
  { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 1000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
  { id: 'price_y', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 10000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
]

describe('Hylo Pro mutations', () => {
  let admin, member, group, saved, checkoutCalls, portalCalls

  before(async () => {
    await setup.clearDb()
    admin = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  beforeEach(() => {
    saved = {}
    for (const name of STUBBED_NAMESPACES) saved[name] = stripeMock[name]
    HyloProService.clearCache()
    checkoutCalls = []
    portalCalls = []
    stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
    stripeMock.prices = { list: async () => ({ data: PRICES }) }
    stripeMock.checkout = {
      sessions: {
        create: async params => {
          checkoutCalls.push(params)
          return { id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }
        }
      }
    }
    stripeMock.billingPortal = {
      configurations: {
        list: async () => ({ data: [{ id: 'bpc_pro', metadata: { hylo_pro_portal: 'true' }, features: { subscription_update: { products: [{ product: 'hylo_pro', prices: ['price_m', 'price_y'] }] } } }] })
      },
      sessions: {
        create: async params => {
          portalCalls.push(params)
          return { url: 'https://billing.stripe.com/p/session/test_1' }
        }
      }
    }
  })

  afterEach(async () => {
    for (const name of STUBBED_NAMESPACES) stripeMock[name] = saved[name]
    HyloProService.clearCache()
    await HyloProSubscription.query().where({ group_id: group.id }).del()
  })

  after(() => setup.clearDb())

  describe('createHyloProCheckoutSession', () => {
    it('returns a Checkout URL for a steward with Administration', async () => {
      const result = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' })
      expect(result.url).to.equal('https://checkout.stripe.com/c/pay/cs_1')
      expect(checkoutCalls[0].line_items).to.deep.equal([{ price: 'price_m', quantity: 1 }])
    })

    it('rejects members without Administration', async () => {
      await expect(createHyloProCheckoutSession(member.id, { groupId: group.id, interval: 'month' }))
        .to.be.rejectedWith(/permission to manage this group's billing/)
      expect(checkoutCalls).to.deep.equal([])
    })

    it('rejects logged-out users', async () => {
      await expect(createHyloProCheckoutSession(null, { groupId: group.id, interval: 'month' }))
        .to.be.rejectedWith(/logged in/)
    })

    it('rejects spaces', async () => {
      const space = await factories.group({ type: 'space', parent_id: group.id }).save()
      await admin.joinGroup(space, { assignAdministrator: true })
      await expect(createHyloProCheckoutSession(admin.id, { groupId: space.id, interval: 'month' }))
        .to.be.rejectedWith(/not spaces/)
    })

    it('rejects an unknown interval', async () => {
      await expect(createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'week' }))
        .to.be.rejectedWith(/interval must be one of/)
    })

    it('rejects a second subscription while one is active', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_active', stripe_customer_id: 'cus_1' }).save()
      await expect(createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'year' }))
        .to.be.rejectedWith(/already has a Hylo Pro subscription/)
      expect(checkoutCalls).to.deep.equal([])
    })

    it('rejects a new subscription while a payment is failing on the existing one', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'past_due', stripe_subscription_id: 'sub_past_due', stripe_customer_id: 'cus_1' }).save()
      await expect(createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' }))
        .to.be.rejectedWith(/already has a Hylo Pro subscription/)
    })

    it('allows subscribing again after a subscription ended', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_ended', stripe_customer_id: 'cus_ended', ended_at: new Date('2026-01-01') }).save()
      const result = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' })
      expect(result.url).to.equal('https://checkout.stripe.com/c/pay/cs_1')
      expect(checkoutCalls[0].customer).to.equal('cus_ended')
    })
  })

  describe('createHyloProPortalSession', () => {
    it('returns a portal URL for the customer the group paid with', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_portal', stripe_customer_id: 'cus_portal' }).save()

      const result = await createHyloProPortalSession(admin.id, { groupId: group.id })

      expect(result.url).to.equal('https://billing.stripe.com/p/session/test_1')
      expect(portalCalls[0]).to.include({ customer: 'cus_portal', configuration: 'bpc_pro' })
      expect(portalCalls[0].return_url).to.match(/\/settings\/billing$/)
    })

    it('errors when the group never subscribed', async () => {
      await expect(createHyloProPortalSession(admin.id, { groupId: group.id }))
        .to.be.rejectedWith(/no Hylo Pro subscription to manage/)
    })

    it('rejects members without Administration', async () => {
      await expect(createHyloProPortalSession(member.id, { groupId: group.id }))
        .to.be.rejectedWith(/permission/)
      expect(portalCalls).to.deep.equal([])
    })
  })
})
