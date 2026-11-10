/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { withFeatureFlag } from '../../../test/setup/helpers'
import { HYLO_PRO } from '../../../lib/featureFlags'
import HyloProService from '../../services/HyloProService'
import { activateHyloProCheckoutSession, createHyloProCheckoutSession, createHyloProPortalSession } from './hyloPro'

/* global bookshelf, HyloProSubscription */

const Stripe = require('stripe')

// test/setup/core makes every `new Stripe()` return this one shared mock client
const stripeMock = new Stripe('sk_test_fake')
const STUBBED_NAMESPACES = ['products', 'prices', 'checkout', 'billingPortal', 'subscriptions', 'customers']

const PERIOD_END = 4102444800 // 2100-01-01, so rows stay active whatever the real date

function stripeSubscription (attrs) {
  return {
    object: 'subscription',
    status: 'active',
    items: { data: [{ current_period_end: PERIOD_END, price: { id: 'price_m', recurring: { interval: 'month' } } }] },
    ...attrs
  }
}

const PRICES = [
  { id: 'price_m', lookup_key: 'hylo_pro_monthly_usd', product: 'hylo_pro', unit_amount: 1000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
  { id: 'price_y', lookup_key: 'hylo_pro_yearly_usd', product: 'hylo_pro', unit_amount: 10000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } }
]

describe('Hylo Pro mutations', () => {
  let admin, member, group, saved, checkoutCalls, portalCalls, stripeSubscriptions

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
    stripeSubscriptions = []
    stripeMock.customers = { create: async () => ({ id: 'cus_created' }) }
    stripeMock.subscriptions = {
      list: async ({ customer }) => ({ data: stripeSubscriptions.filter(sub => sub.customer === customer) }),
      retrieve: async id => stripeSubscriptions.find(sub => sub.id === id)
    }
    stripeMock.products = { retrieve: async () => ({ id: 'hylo_pro', active: true }) }
    stripeMock.prices = { list: async () => ({ data: PRICES }) }
    stripeMock.checkout = {
      sessions: {
        list: async () => ({ data: [] }),
        create: async params => {
          checkoutCalls.push(params)
          return { id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }
        }
      }
    }
    stripeMock.billingPortal = {
      configurations: {
        list: async () => ({ data: [{ id: 'bpc_pro', metadata: { hylo_pro_portal: 'true' }, features: { subscription_update: { products: [{ product: 'hylo_pro', prices: ['price_m', 'price_y'] }] } } }] }),
        update: async id => ({ id })
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
    await bookshelf.knex('hylo_pro_customers').where({ group_id: group.id }).del()
  })

  after(() => setup.clearDb())

  describe('while the HYLO_PRO flag is off', () => {
    async function expectDisabled (call) {
      const error = await withFeatureFlag(HYLO_PRO, 'off', call).catch(e => e)
      expect(error).to.be.an.instanceOf(Error)
      expect(error.message).to.match(/Hylo Pro is not available/)
      expect(error.extensions.code).to.equal('HYLO_PRO_DISABLED')
    }

    it('refuses to start Checkout', async () => {
      await expectDisabled(() => createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' }))
      expect(checkoutCalls).to.deep.equal([])
    })

    it('refuses to activate a Checkout session', async () => {
      let retrieved = false
      stripeMock.checkout = { sessions: { retrieve: async () => { retrieved = true } } }
      await expectDisabled(() => activateHyloProCheckoutSession(admin.id, { groupId: group.id, sessionId: 'cs_done' }))
      expect(retrieved).to.be.false
    })

    it('refuses to open the billing portal', async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_portal' })
      await expectDisabled(() => createHyloProPortalSession(admin.id, { groupId: group.id }))
      expect(portalCalls).to.deep.equal([])
    })

    it('allows them again once the flag is on', async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_portal' })
      const checkout = await withFeatureFlag(HYLO_PRO, 'on', () => createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' }))
      expect(checkout.url).to.equal('https://checkout.stripe.com/c/pay/cs_1')
      const portal = await withFeatureFlag(HYLO_PRO, 'on', () => createHyloProPortalSession(admin.id, { groupId: group.id }))
      expect(portal.url).to.equal('https://billing.stripe.com/p/session/test_1')
    })
  })

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

    // The group's customer, a subscription in Stripe and our (synced) row for it
    async function subscribed (status, id) {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_1' })
      stripeSubscriptions.push(stripeSubscription({ id, customer: 'cus_1', status, metadata: { hylo_pro: 'true', group_id: String(group.id) } }))
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status, stripe_subscription_id: id, stripe_customer_id: 'cus_1', current_period_end: new Date(PERIOD_END * 1000) }).save()
    }

    it('rejects a second subscription while one is active', async () => {
      await subscribed('active', 'sub_active')
      await expect(createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'year' }))
        .to.be.rejectedWith(/already has a Hylo Pro subscription/)
      expect(checkoutCalls).to.deep.equal([])
    })

    for (const status of ['past_due', 'unpaid', 'incomplete', 'paused']) {
      it(`rejects a new subscription while the existing one is ${status}`, async () => {
        await subscribed(status, `sub_${status}`)
        const error = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' }).catch(e => e)
        expect(error.message).to.match(/already has a Hylo Pro subscription/)
        expect(error.extensions.code).to.equal('HYLO_PRO_ALREADY_SUBSCRIBED')
        expect(checkoutCalls).to.deep.equal([])
      })
    }

    it("rejects a new subscription when Stripe has one our table doesn't know about yet", async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_known' })
      stripeSubscriptions.push(stripeSubscription({ id: 'sub_webhook_pending', customer: 'cus_known', metadata: { hylo_pro: 'true', group_id: String(group.id) } }))

      const error = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' }).catch(e => e)
      expect(error.extensions.code).to.equal('HYLO_PRO_ALREADY_SUBSCRIBED')
      expect(checkoutCalls).to.deep.equal([])
      expect(await group.hasPro()).to.be.true
    })

    it('lets the group subscribe when our row still says active but Stripe canceled it (missed webhook)', async () => {
      await subscribed('active', 'sub_stale')
      stripeSubscriptions[0].status = 'canceled'

      const result = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' })

      expect(result.url).to.equal('https://checkout.stripe.com/c/pay/cs_1')
      const row = await HyloProSubscription.where({ stripe_subscription_id: 'sub_stale' }).fetch()
      expect(row.get('status')).to.equal('canceled')
      expect(await group.hasPro()).to.be.false
    })

    it('allows subscribing again after a subscription ended', async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_ended' })
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_ended', stripe_customer_id: 'cus_ended', ended_at: new Date('2026-01-01') }).save()
      const result = await createHyloProCheckoutSession(admin.id, { groupId: group.id, interval: 'month' })
      expect(result.url).to.equal('https://checkout.stripe.com/c/pay/cs_1')
      expect(checkoutCalls[0].customer).to.equal('cus_ended')
    })
  })

  describe('activateHyloProCheckoutSession', () => {
    it('activates Pro from the Checkout session the steward returned with', async () => {
      const metadata = { hylo_pro: 'true', group_id: String(group.id) }
      stripeMock.checkout = { sessions: { retrieve: async () => ({ id: 'cs_done', mode: 'subscription', subscription: 'sub_done', metadata }) } }
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_done' })
      stripeSubscriptions.push(stripeSubscription({ id: 'sub_done', customer: 'cus_done', metadata }))

      const result = await activateHyloProCheckoutSession(admin.id, { groupId: group.id, sessionId: 'cs_done' })

      expect(result).to.deep.equal({ success: true, active: true })
      expect(await group.hasPro()).to.be.true
    })

    it('rejects members without Administration', async () => {
      let retrieved = false
      stripeMock.checkout = { sessions: { retrieve: async () => { retrieved = true } } }
      await expect(activateHyloProCheckoutSession(member.id, { groupId: group.id, sessionId: 'cs_done' }))
        .to.be.rejectedWith(/permission/)
      expect(retrieved).to.be.false
    })
  })

  describe('createHyloProPortalSession', () => {
    it('returns a portal URL for the customer the group paid with', async () => {
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_portal' })

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
