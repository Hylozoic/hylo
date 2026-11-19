/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
/* global ContentAccess, StripeAccount, StripeProduct, SubscriptionChangeEvent */

let currentWebhookEvent = null

describe('StripeController.webhook', () => {
  let StripeController
  let req
  let res

  before(() => {
    StripeController = require(root('api/controllers/StripeController'))
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

  describe('Hylo Pro events', () => {
    const stripeMock = new (require('stripe'))('sk_test_fake')
    let group, savedSubscriptions, savedHandlers

    beforeEach(async () => {
      group = await factories.group().save()
      await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_pro' })
      savedSubscriptions = stripeMock.subscriptions
      savedHandlers = {
        handleSubscriptionUpdated: StripeController.handleSubscriptionUpdated,
        handleCheckoutSessionCompleted: StripeController.handleCheckoutSessionCompleted
      }
      StripeController.handleSubscriptionUpdated = spy(async () => {})
      StripeController.handleCheckoutSessionCompleted = spy(async () => {})
    })

    afterEach(() => {
      stripeMock.subscriptions = savedSubscriptions
      Object.assign(StripeController, savedHandlers)
    })

    function proSubscription (overrides = {}) {
      return {
        id: 'sub_pro_webhook',
        object: 'subscription',
        status: 'active',
        customer: 'cus_pro',
        cancel_at_period_end: false,
        metadata: { hylo_pro: 'true', group_id: String(group.id) },
        items: { data: [{ current_period_end: 4102444800, price: { id: 'price_y', recurring: { interval: 'year' } } }] },
        ...overrides
      }
    }

    it('syncs platform Pro events and keeps them away from the Connect handlers', async () => {
      const retrieved = []
      stripeMock.subscriptions = {
        retrieve: async id => {
          retrieved.push(id)
          return proSubscription()
        }
      }
      currentWebhookEvent = {
        id: 'evt_pro_updated',
        type: 'customer.subscription.updated',
        data: { object: proSubscription() }
      }

      await StripeController.webhook(req, res)

      expect(res.body.received).to.equal(true)
      expect(retrieved).to.deep.equal(['sub_pro_webhook'])
      expect(StripeController.handleSubscriptionUpdated).to.not.have.been.called()
      expect(await group.hasPro()).to.be.true

      const stored = await bookshelf.knex('stripe_webhook_processed_events').where({ stripe_event_id: 'evt_pro_updated' }).first()
      expect(stored).to.not.equal(undefined)
    })

    it('skips a Pro event already processed', async () => {
      await bookshelf.knex('stripe_webhook_processed_events').insert({ stripe_event_id: 'evt_pro_dup' })
      const retrieved = []
      stripeMock.subscriptions = { retrieve: async id => { retrieved.push(id); return proSubscription() } }
      currentWebhookEvent = { id: 'evt_pro_dup', type: 'customer.subscription.updated', data: { object: proSubscription() } }

      await StripeController.webhook(req, res)

      expect(res.body.duplicate).to.equal(true)
      expect(retrieved).to.deep.equal([])
    })

    it('does not mark a Pro event processed when syncing fails, so Stripe retries it', async () => {
      stripeMock.subscriptions = { retrieve: async () => { throw new Error('stripe down') } }
      currentWebhookEvent = { id: 'evt_pro_fail', type: 'customer.subscription.updated', data: { object: proSubscription() } }

      await StripeController.webhook(req, res)

      expect(res.statusCode).to.equal(400)
      const stored = await bookshelf.knex('stripe_webhook_processed_events').where({ stripe_event_id: 'evt_pro_fail' }).first()
      expect(stored).to.equal(undefined)
    })

    it('sends Connect events to the Connect handlers even if their metadata looks like Pro', async () => {
      await StripeAccount.forge({ stripe_account_external_id: 'acct_known_pro_lookalike' }).save()
      const retrieved = []
      stripeMock.subscriptions = { retrieve: async id => { retrieved.push(id); return proSubscription() } }
      currentWebhookEvent = {
        id: 'evt_connect_lookalike',
        type: 'customer.subscription.updated',
        account: 'acct_known_pro_lookalike',
        data: { object: proSubscription() }
      }

      await StripeController.webhook(req, res)

      expect(res.body.received).to.equal(true)
      expect(StripeController.handleSubscriptionUpdated).to.have.been.called()
      expect(retrieved).to.deep.equal([])
      expect(await group.hasPro()).to.be.false
    })
  })

  describe('signature verification', () => {
    const stripeMock = new (require('stripe'))('sk_test_fake')
    let savedWebhooks, savedEnv, triedSecrets

    // Stripe signs each endpoint with its own secret; this fake accepts only `validSecret`
    function signedWith (validSecret, event = { id: `evt_signed_${validSecret}`, type: 'product.created', data: { object: {} } }) {
      triedSecrets = []
      stripeMock.webhooks = {
        constructEvent: (payload, signature, secret) => {
          triedSecrets.push(secret)
          if (secret !== validSecret) throw new Error('No signatures found matching the expected signature for payload')
          return event
        }
      }
    }

    beforeEach(() => {
      delete global.__stripeWebhookConstructEvent
      savedWebhooks = stripeMock.webhooks
      savedEnv = {
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        STRIPE_PLATFORM_WEBHOOK_SECRET: process.env.STRIPE_PLATFORM_WEBHOOK_SECRET,
        STRIPE_WEBHOOK_BYPASS_SIGNATURE: process.env.STRIPE_WEBHOOK_BYPASS_SIGNATURE
      }
      delete process.env.STRIPE_WEBHOOK_BYPASS_SIGNATURE
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_connect'
      process.env.STRIPE_PLATFORM_WEBHOOK_SECRET = 'whsec_platform'
    })

    afterEach(() => {
      stripeMock.webhooks = savedWebhooks
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    it('accepts events signed by the Connect endpoint secret', async () => {
      signedWith('whsec_connect')
      await StripeController.webhook(req, res)
      expect(res.statusCode).to.not.equal(400)
      expect(res.body.received).to.equal(true)
      expect(triedSecrets).to.deep.equal(['whsec_connect'])
    })

    it('accepts events signed by the platform endpoint secret', async () => {
      signedWith('whsec_platform')
      await StripeController.webhook(req, res)
      expect(res.body.received).to.equal(true)
      expect(triedSecrets).to.deep.equal(['whsec_connect', 'whsec_platform'])
      const stored = await bookshelf.knex('stripe_webhook_processed_events').where({ stripe_event_id: 'evt_signed_whsec_platform' }).first()
      expect(stored).to.not.equal(undefined)
    })

    it('acknowledges non-Pro platform endpoint events without running the Connect handlers', async () => {
      const savedHandler = StripeController.handleChargeRefunded
      StripeController.handleChargeRefunded = spy(async () => {})
      try {
        // e.g. a refund of a Hylo Pro charge: the charge carries no Pro metadata
        signedWith('whsec_platform', { id: 'evt_platform_refund', type: 'charge.refunded', data: { object: { id: 'ch_1', metadata: {} } } })
        await StripeController.webhook(req, res)
        expect(res.body).to.deep.equal({ received: true, skipped: 'platform_event' })
        expect(StripeController.handleChargeRefunded).to.not.have.been.called()
        const stored = await bookshelf.knex('stripe_webhook_processed_events').where({ stripe_event_id: 'evt_platform_refund' }).first()
        expect(stored).to.not.equal(undefined)

        // The same event type from the Connect endpoint still reaches its handler
        await StripeAccount.forge({ stripe_account_external_id: 'acct_refund' }).save()
        signedWith('whsec_connect', { id: 'evt_connect_refund', type: 'charge.refunded', account: 'acct_refund', data: { object: { id: 'ch_2' } } })
        res = factories.mock.response()
        await StripeController.webhook(req, res)
        expect(res.body).to.deep.equal({ received: true })
        expect(StripeController.handleChargeRefunded).to.have.been.called()
      } finally {
        StripeController.handleChargeRefunded = savedHandler
      }
    })

    it('works with only the platform secret set', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      signedWith('whsec_platform')
      await StripeController.webhook(req, res)
      expect(res.body.received).to.equal(true)
      expect(triedSecrets).to.deep.equal(['whsec_platform'])
    })

    it('rejects events no configured secret signed', async () => {
      signedWith('whsec_someone_else')
      await StripeController.webhook(req, res)
      expect(res.statusCode).to.equal(400)
      expect(res.body).to.deep.equal({ error: 'Invalid signature' })
    })

    it('fails when no secret is configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET
      delete process.env.STRIPE_PLATFORM_WEBHOOK_SECRET
      signedWith('whsec_connect')
      await StripeController.webhook(req, res)
      expect(res.statusCode).to.equal(500)
      expect(triedSecrets).to.deep.equal([])
    })
  })
})
