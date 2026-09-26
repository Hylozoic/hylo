/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify } = require(root('test/setup/helpers'))
/* global ContentAccess, StripeProduct, SubscriptionChangeEvent, Frontend, Queue */

let currentWebhookEvent = null

describe('StripeController.webhook', () => {
  let StripeController
  let originalHandlers
  let req
  let res

  before(() => {
    StripeController = require(root('api/controllers/StripeController'))
    originalHandlers = {
      handleInvoicePaid: StripeController.handleInvoicePaid,
      handleInvoicePaymentFailed: StripeController.handleInvoicePaymentFailed
    }
  })

  afterEach(() => {
    Object.assign(StripeController, originalHandlers)
  })

  after(() => {
    delete global.__stripeWebhookConstructEvent
  })

  beforeEach(async () => {
    await setup.clearDb()
    req = factories.mock.request()
    res = factories.mock.response()
    req.body = Buffer.from('fake-body')
    req.headers['stripe-signature'] = 'sig_test'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    currentWebhookEvent = null
    global.__stripeWebhookConstructEvent = () => currentWebhookEvent
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

describe('subscription email links', () => {
  let StripeController, user, group, product, queued

  before(() => {
    StripeController = require(root('api/controllers/StripeController'))
  })

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
    product = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_links',
      stripe_price_id: 'price_links',
      name: 'Monthly Membership',
      description: 'monthly',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    queued = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      queued.push({ className, methodName, data })
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it('links the payment failed email to my transactions', async () => {
    await ContentAccess.create({
      user_id: user.id,
      granted_by_group_id: group.id,
      group_id: group.id,
      product_id: product.id,
      access_type: ContentAccess.Type.STRIPE_PURCHASE,
      stripe_session_id: 'cs_links_failed',
      stripe_subscription_id: 'sub_links_failed',
      status: ContentAccess.Status.ACTIVE
    })

    await StripeController.handleInvoicePaymentFailed({
      data: { object: { id: 'in_links_failed', subscription: 'sub_links_failed', last_payment_error: { message: 'Card declined' } } }
    })

    const email = queued.find(q => q.methodName === 'sendPaymentFailed')
    expect(email).to.exist
    expect(email.data.data.manage_subscription_url).to.equal(Frontend.Route.myTransactions())
    expect(email.data.data.update_payment_url).to.equal(Frontend.Route.myTransactions())
    expect(Frontend.Route.myTransactions()).to.match(/\/my\/transactions$/)
  })

  it('links the renewal reminder email to my transactions', async () => {
    await ContentAccess.create({
      user_id: user.id,
      granted_by_group_id: group.id,
      group_id: group.id,
      product_id: product.id,
      access_type: ContentAccess.Type.STRIPE_PURCHASE,
      stripe_session_id: 'cs_links_reminder',
      stripe_subscription_id: 'sub_links_reminder',
      status: ContentAccess.Status.ACTIVE,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })

    await ContentAccess.sendRenewalReminders()

    const email = queued.find(q => q.methodName === 'sendSubscriptionRenewalReminder')
    expect(email).to.exist
    expect(email.data.data.manage_subscription_url).to.equal(Frontend.Route.myTransactions())
    expect(email.data.data.update_payment_url).to.equal(Frontend.Route.myTransactions())
  })
})
