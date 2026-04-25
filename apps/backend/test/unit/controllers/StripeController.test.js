/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const mock = require('mock-require')

/* global ContentAccess, StripeProduct, SubscriptionChangeEvent */

let currentWebhookEvent = null

const stripeMockFactory = function () {
  return {
    webhooks: {
      constructEvent: () => currentWebhookEvent
    },
    subscriptions: {
      retrieve: async () => ({})
    },
    invoices: {
      retrieve: async () => ({})
    },
    paymentIntents: {
      retrieve: async () => ({})
    },
    checkout: {
      sessions: {
        list: async () => ({ data: [] })
      }
    },
    products: {
      retrieve: async () => ({})
    }
  }
}

describe('StripeController.webhook', () => {
  let StripeController
  let req
  let res

  before(() => {
    mock('stripe', stripeMockFactory)
    StripeController = mock.reRequire(root('api/controllers/StripeController'))
  })

  beforeEach(async () => {
    await setup.clearDb()
    req = factories.mock.request()
    res = factories.mock.response()
    req.body = Buffer.from('fake-body')
    req.headers['stripe-signature'] = 'sig_test'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    currentWebhookEvent = null
  })

  it('skips webhook when connect account is unknown', async () => {
    currentWebhookEvent = {
      id: 'evt_unknown_acct',
      type: 'invoice.paid',
      account: 'acct_unknown',
      data: { object: { id: 'in_test', subscription: 'sub_test' } }
    }

    StripeController.handleInvoicePaid = spy(async () => {})

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)
    expect(res.body.skipped).to.equal('unknown_connect_account')
    expect(StripeController.handleInvoicePaid).to.not.have.been.called()

    const stored = await bookshelf.knex('stripe_webhook_processed_events')
      .where({ stripe_event_id: 'evt_unknown_acct' })
      .first()
    expect(stored).to.equal(undefined)
  })

  it('skips duplicate webhook events', async () => {
    await bookshelf.knex('stripe_webhook_processed_events').insert({
      stripe_event_id: 'evt_duplicate'
    })

    currentWebhookEvent = {
      id: 'evt_duplicate',
      type: 'invoice.paid',
      data: { object: { id: 'in_test', subscription: 'sub_test' } }
    }

    StripeController.handleInvoicePaid = spy(async () => {})

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)
    expect(res.body.duplicate).to.equal(true)
    expect(StripeController.handleInvoicePaid).to.not.have.been.called()
  })

  it('marks webhook as processed after successful handler run', async () => {
    currentWebhookEvent = {
      id: 'evt_success',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_fail', subscription: null } }
    }

    StripeController.handleInvoicePaymentFailed = spy(async () => {})

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)
    expect(StripeController.handleInvoicePaymentFailed).to.have.been.called()

    const stored = await bookshelf.knex('stripe_webhook_processed_events')
      .where({ stripe_event_id: 'evt_success' })
      .first()
    expect(stored).to.not.equal(undefined)
  })

  it('does not mark webhook as processed when handler throws', async () => {
    currentWebhookEvent = {
      id: 'evt_fail',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_fail', subscription: null } }
    }

    StripeController.handleInvoicePaymentFailed = spy(async () => {
      throw new Error('handler boom')
    })

    await StripeController.webhook(req, res)

    expect(res.statusCode).to.equal(400)
    expect(res.body.error).to.equal('Webhook processing failed')
    expect(res.body.message).to.equal('handler boom')

    const stored = await bookshelf.knex('stripe_webhook_processed_events')
      .where({ stripe_event_id: 'evt_fail' })
      .first()
    expect(stored).to.equal(undefined)
  })

  it('applies scheduled membership change sync on customer.subscription.updated', async () => {
    const user = await factories.user().save()
    const group = await factories.group().save()
    const fromProduct = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_from_sched',
      stripe_price_id: 'price_from_sched',
      name: 'From Scheduled',
      description: 'from',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    const toProduct = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_to_sched',
      stripe_price_id: 'price_to_sched',
      name: 'To Scheduled',
      description: 'to',
      price_in_cents: 2000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })

    await ContentAccess.create({
      user_id: user.id,
      granted_by_group_id: group.id,
      group_id: group.id,
      product_id: fromProduct.id,
      access_type: ContentAccess.Type.STRIPE_PURCHASE,
      stripe_session_id: 'cs_sched',
      stripe_subscription_id: 'sub_sched_123',
      status: ContentAccess.Status.ACTIVE
    })

    await SubscriptionChangeEvent.forge({
      user_id: user.id,
      group_id: group.id,
      correlation_id: 'corr_sched_123',
      from_product_id: fromProduct.id,
      to_product_id: toProduct.id,
      mode: 'scheduled_period_end',
      stripe_subscription_id: 'sub_sched_123',
      status: 'pending',
      payload: {
        targetStripePriceId: 'price_to_sched'
      }
    }).save()

    currentWebhookEvent = {
      id: 'evt_sched_apply',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_sched_123',
          status: 'active',
          cancel_at_period_end: false,
          cancel_at: null,
          metadata: {
            hylo_correlation_id: 'corr_sched_123'
          },
          items: {
            data: [
              { id: 'si_123', price: { id: 'price_to_sched' } }
            ]
          }
        }
      }
    }

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)

    const refreshedAccess = await ContentAccess.where({ stripe_subscription_id: 'sub_sched_123' }).fetch()
    expect(refreshedAccess.get('product_id')).to.equal(toProduct.id)

    const changeEvent = await SubscriptionChangeEvent.where({ correlation_id: 'corr_sched_123' }).fetch()
    expect(changeEvent.get('status')).to.equal('applied')
    const payload = changeEvent.get('payload') || {}
    expect(payload.applied).to.equal(true)
    expect(payload.syncedContentAccessCount).to.equal(1)
  })

  it('marks lifetime_no_proration pending event applied on customer.subscription.deleted', async () => {
    const user = await factories.user().save()
    const group = await factories.group().save()

    await SubscriptionChangeEvent.forge({
      user_id: user.id,
      group_id: group.id,
      correlation_id: 'corr_lifetime_123',
      from_product_id: null,
      to_product_id: null,
      mode: 'lifetime_no_proration',
      stripe_subscription_id: 'sub_lifetime_123',
      status: 'pending',
      payload: {
        requiresLifetimeCheckout: true
      }
    }).save()

    currentWebhookEvent = {
      id: 'evt_lifetime_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_lifetime_123',
          status: 'canceled'
        }
      }
    }

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)

    const changeEvent = await SubscriptionChangeEvent.where({ correlation_id: 'corr_lifetime_123' }).fetch()
    expect(changeEvent.get('status')).to.equal('applied')
    expect(changeEvent.get('applied_at')).to.exist
    const payload = changeEvent.get('payload') || {}
    expect(payload.applied).to.equal(true)
    expect(payload.appliedFromWebhookType).to.equal('customer.subscription.deleted')
    expect(payload.appliedFromWebhookEventId).to.equal('evt_lifetime_deleted')
  })
})
