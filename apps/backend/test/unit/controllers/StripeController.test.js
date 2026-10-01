/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify } = require(root('test/setup/helpers'))
/* global bookshelf, ContentAccess, StripeProduct, SubscriptionChangeEvent, Frontend, Queue */

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

  describe('with a stubbed subscription', () => {
    let stripeClient, originalSubscriptionRetrieve
    const now = Math.floor(Date.now() / 1000)

    beforeEach(() => {
      stripeClient = require('stripe')()
      originalSubscriptionRetrieve = stripeClient.subscriptions.retrieve
      stripeClient.subscriptions.retrieve = async () => ({ current_period_start: now, current_period_end: now + 30 * 24 * 60 * 60 })
    })

    afterEach(() => {
      stripeClient.subscriptions.retrieve = originalSubscriptionRetrieve
    })

    it('links the purchase confirmation email to my transactions', async () => {
      await StripeController.handleCheckoutSessionCompleted({
        data: {
          object: {
            id: 'cs_links_purchase',
            payment_status: 'paid',
            mode: 'subscription',
            subscription: 'sub_links_purchase',
            created: now,
            amount_total: 1000,
            currency: 'usd',
            metadata: { userId: String(user.id), groupId: String(group.id), offeringId: String(product.id) }
          }
        }
      })

      const email = queued.find(q => q.methodName === 'sendPurchaseConfirmation')
      expect(email).to.exist
      expect(email.data.data.is_subscription).to.be.ok
      expect(email.data.data.manage_subscription_url).to.equal(Frontend.Route.myTransactions())
    })

    it('links the subscription renewed email to my transactions', async () => {
      await ContentAccess.create({
        user_id: user.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        product_id: product.id,
        access_type: ContentAccess.Type.STRIPE_PURCHASE,
        stripe_session_id: 'cs_links_renewed',
        stripe_subscription_id: 'sub_links_renewed',
        status: ContentAccess.Status.ACTIVE
      })

      await StripeController.handleInvoicePaid({
        data: {
          object: {
            id: 'in_links_renewed',
            subscription: 'sub_links_renewed',
            billing_reason: 'subscription_cycle',
            amount_paid: 1000,
            currency: 'usd',
            created: now
          }
        }
      })

      const email = queued.find(q => q.methodName === 'sendSubscriptionRenewed')
      expect(email).to.exist
      expect(email.data.data.manage_subscription_url).to.equal(Frontend.Route.myTransactions())
    })
  })
})

describe('StripeController delayed checkout payments', () => {
  let StripeController, user, group, product, req, res

  const sessionFor = (attrs = {}) => ({
    id: 'cs_delayed',
    mode: 'payment',
    payment_status: 'paid',
    created: Math.floor(Date.now() / 1000),
    amount_total: 1500,
    currency: 'usd',
    metadata: { userId: String(user.id), groupId: String(group.id), offeringId: String(product.id) },
    ...attrs
  })

  const accessRows = () => ContentAccess.where({ stripe_session_id: 'cs_delayed' }).fetchAll()

  before(() => {
    StripeController = require(root('api/controllers/StripeController'))
  })

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
    const stripeAccount = await factories.stripeAccount({ stripe_account_external_id: 'acct_delayed' }).save()
    await group.save({ stripe_account_id: stripeAccount.id }, { patch: true })
    product = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_delayed',
      stripe_price_id: 'price_delayed',
      name: 'Season Pass',
      description: 'season',
      price_in_cents: 1500,
      currency: 'usd',
      renewal_policy: 'manual',
      duration: 'season',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    mockify(Queue, 'classMethod', () => Promise.resolve())
    req = factories.mock.request()
    res = factories.mock.response()
    req.body = Buffer.from('fake-body')
    req.headers['stripe-signature'] = 'sig_test'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    delete global.__stripeWebhookConstructEvent
  })

  it('grants nothing when checkout completes before a delayed payment clears', async () => {
    await StripeController.handleCheckoutSessionCompleted({ account: 'acct_delayed', data: { object: sessionFor({ payment_status: 'unpaid' }) } })

    expect((await accessRows()).length).to.equal(0)
  })

  it('grants access when the delayed payment succeeds', async () => {
    global.__stripeWebhookConstructEvent = () => ({
      id: 'evt_async_succeeded',
      type: 'checkout.session.async_payment_succeeded',
      account: 'acct_delayed',
      data: { object: sessionFor() }
    })

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)
    const rows = await accessRows()
    expect(rows.length).to.equal(1)
    expect(rows.first().get('status')).to.equal(ContentAccess.Status.ACTIVE)
  })

  describe('with a promotion code', () => {
    let StripeService, stripeClient, originalSessionRetrieve, feeRefundCalls

    beforeEach(() => {
      StripeService = require(root('api/services/StripeService'))
      stripeClient = require('stripe')()
      originalSessionRetrieve = stripeClient.checkout.sessions.retrieve
      stripeClient.checkout.sessions.retrieve = async () => ({
        line_items: {
          data: [{ description: 'Season Pass', quantity: 1, amount_total: 500, price: { unit_amount: 10000, product: { name: 'Season Pass' } } }]
        }
      })
      feeRefundCalls = []
      mockify(StripeService, 'refundApplicationFeeAboveShare', async params => {
        feeRefundCalls.push(params)
        return 665
      })
    })

    afterEach(() => {
      stripeClient.checkout.sessions.retrieve = originalSessionRetrieve
      unspyify(StripeService, 'refundApplicationFeeAboveShare')
    })

    it('refunds the part of the application fee above Hylo\'s share of what was paid', async () => {
      await StripeController.handleCheckoutSessionCompleted({
        account: 'acct_delayed',
        data: { object: sessionFor({ amount_total: 500, payment_intent: 'pi_promo', total_details: { amount_discount: 9500 } }) }
      })

      expect(feeRefundCalls).to.deep.equal([{ accountId: 'acct_delayed', paymentIntentId: 'pi_promo', paidAmount: 500 }])
    })

    describe('and a Hylo contribution', () => {
      let transferCalls

      beforeEach(() => {
        stripeClient.checkout.sessions.retrieve = async () => ({
          line_items: {
            data: [
              { description: 'Season Pass', quantity: 1, amount_total: 5000, price: { unit_amount: 10000, product: { name: 'Season Pass' } } },
              { description: 'Hylo Platform Contribution', quantity: 1, amount_total: 500, price: { unit_amount: 1000, product: { name: 'Hylo Platform Contribution' } } }
            ]
          }
        })
        transferCalls = []
        mockify(StripeService, 'transferContributionToPlatform', async params => {
          transferCalls.push(params)
          return {}
        })
      })

      afterEach(() => {
        unspyify(StripeService, 'transferContributionToPlatform')
      })

      it('counts only what was paid for the offering, and transfers only what was paid for the contribution', async () => {
        await StripeController.handleCheckoutSessionCompleted({
          account: 'acct_delayed',
          data: { object: sessionFor({ amount_total: 5600, payment_intent: 'pi_promo_contribution', total_details: { amount_discount: 5500 } }) }
        })

        expect(feeRefundCalls).to.deep.equal([{ accountId: 'acct_delayed', paymentIntentId: 'pi_promo_contribution', paidAmount: 5000 }])
        expect(transferCalls).to.have.length(1)
        expect(transferCalls[0]).to.include({ connectedAccountId: 'acct_delayed', paymentIntentId: 'pi_promo_contribution', donationAmount: 500 })
      })

      it('recognizes the contribution by its current name in any language', async () => {
        stripeClient.checkout.sessions.retrieve = async () => ({
          line_items: {
            data: [
              { description: 'Season Pass', quantity: 1, amount_total: 5000, price: { unit_amount: 10000, product: 'prod_pass' } },
              { description: 'Wähle deinen Hylo-Beitrag', quantity: 5, amount_total: 500, price: { unit_amount: 100, product: 'prod_contribution' } }
            ]
          }
        })

        await StripeController.handleCheckoutSessionCompleted({
          account: 'acct_delayed',
          data: { object: sessionFor({ amount_total: 5500, payment_intent: 'pi_promo_named', total_details: { amount_discount: 5000 } }) }
        })

        expect(feeRefundCalls).to.deep.equal([{ accountId: 'acct_delayed', paymentIntentId: 'pi_promo_named', paidAmount: 5000 }])
        expect(transferCalls).to.have.length(1)
        expect(transferCalls[0]).to.include({ donationAmount: 500 })
      })

      it('recognizes the contribution by its price metadata whatever it is called', async () => {
        stripeClient.checkout.sessions.retrieve = async () => ({
          line_items: {
            data: [
              { description: 'Season Pass', quantity: 1, amount_total: 5000, price: { unit_amount: 10000, product: 'prod_pass' } },
              { description: 'Renamed by someone', quantity: 3, amount_total: 300, price: { unit_amount: 100, product: 'prod_contribution', metadata: { hylo_donation_price: 'true' } } }
            ]
          }
        })

        await StripeController.handleCheckoutSessionCompleted({
          account: 'acct_delayed',
          data: { object: sessionFor({ amount_total: 5300, payment_intent: 'pi_promo_meta', total_details: { amount_discount: 5000 } }) }
        })

        expect(feeRefundCalls).to.deep.equal([{ accountId: 'acct_delayed', paymentIntentId: 'pi_promo_meta', paidAmount: 5000 }])
        expect(transferCalls[0]).to.include({ donationAmount: 300 })
      })
    })

    it('leaves the fee alone when no discount was applied', async () => {
      await StripeController.handleCheckoutSessionCompleted({
        account: 'acct_delayed',
        data: { object: sessionFor({ payment_intent: 'pi_full_price', total_details: { amount_discount: 0 } }) }
      })

      expect(feeRefundCalls).to.have.length(0)
    })
  })

  it('logs a failed delayed payment and grants nothing', async () => {
    global.__stripeWebhookConstructEvent = () => ({
      id: 'evt_async_failed',
      type: 'checkout.session.async_payment_failed',
      account: 'acct_delayed',
      data: { object: sessionFor({ payment_status: 'unpaid' }) }
    })

    await StripeController.webhook(req, res)

    expect(res.body.received).to.equal(true)
    expect((await accessRows()).length).to.equal(0)
    const logs = await bookshelf.knex('stripe_logs').where({ log_type: 'async_payment_failed', external_id: 'cs_delayed' })
    expect(logs).to.have.length(1)
    expect(String(logs[0].group_id)).to.equal(String(group.id))
    expect(logs[0].metadata).to.deep.equal({ offering_id: String(product.id) })
  })
})

describe('StripeController.handleChargeRefunded', () => {
  let StripeController, StripeService, stripeClient, originalRetrieve, originalList, sessionListCalls, user, group, product, sentEmails

  const chargeRefundedEvent = {
    id: 'evt_charge_refunded',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_refunded',
        payment_intent: 'pi_refunded',
        amount: 1500,
        amount_refunded: 1500,
        refunded: true,
        currency: 'usd'
      }
    }
  }

  const purchase = (attrs = {}) => ContentAccess.create({
    user_id: user.id,
    granted_by_group_id: group.id,
    group_id: group.id,
    product_id: product.id,
    access_type: ContentAccess.Type.STRIPE_PURCHASE,
    stripe_session_id: 'cs_refunded',
    status: ContentAccess.Status.ACTIVE,
    ...attrs
  })

  const reload = access => ContentAccess.where({ id: access.id }).fetch()
  const refundLogs = () => bookshelf.knex('stripe_logs').where({ log_type: 'refund', external_id: 'ch_refunded' })

  const connectGroup = async (externalId) => {
    const stripeAccount = await factories.stripeAccount({ stripe_account_external_id: externalId }).save()
    await group.save({ stripe_account_id: stripeAccount.id }, { patch: true })
  }

  before(() => {
    StripeController = require(root('api/controllers/StripeController'))
    StripeService = require(root('api/services/StripeService'))
    stripeClient = require('stripe')()
  })

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user({ settings: { locale: 'fr' } }).save()
    group = await factories.group({ name: 'Garden Club' }).save()
    product = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_refunded',
      stripe_price_id: 'price_refunded',
      name: 'Season Pass',
      description: 'season',
      price_in_cents: 1500,
      currency: 'usd',
      renewal_policy: 'manual',
      duration: 'season',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    originalRetrieve = stripeClient.paymentIntents.retrieve
    originalList = stripeClient.checkout.sessions.list
    // Checkout never writes the real session id onto the payment intent
    stripeClient.paymentIntents.retrieve = async () => ({ metadata: { session_id: 'placeholder' } })
    sessionListCalls = []
    stripeClient.checkout.sessions.list = async (params, options) => {
      sessionListCalls.push({ params, options })
      return { data: params.payment_intent === 'pi_refunded' ? [{ id: 'cs_refunded' }] : [] }
    }
    sentEmails = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      if (className === 'Email' && methodName === 'sendRefundProcessed') sentEmails.push(data)
      return Promise.resolve()
    })
    mockify(ContentAccess, 'revoke', async () => { throw new Error('a refund must not revoke access') })
    mockify(StripeService, 'cancelSubscription', async () => { throw new Error('a refund must not cancel the subscription') })
  })

  afterEach(() => {
    stripeClient.paymentIntents.retrieve = originalRetrieve
    stripeClient.checkout.sessions.list = originalList
    unspyify(Queue, 'classMethod')
    unspyify(ContentAccess, 'revoke')
    unspyify(StripeService, 'cancelSubscription')
  })

  it('keeps access for a full refund issued from the Stripe dashboard, records it and emails the member once', async () => {
    await connectGroup('acct_full')
    const groupAccess = await purchase()
    const roleAccess = await purchase({ metadata: { accessType: 'role' } })

    await StripeController.handleChargeRefunded({ ...chargeRefundedEvent, account: 'acct_full' })

    expect(sessionListCalls).to.deep.equal([{ params: { payment_intent: 'pi_refunded', limit: 1 }, options: { stripeAccount: 'acct_full' } }])
    for (const access of [groupAccess, roleAccess]) {
      const refreshed = await reload(access)
      expect(refreshed.get('status')).to.equal(ContentAccess.Status.ACTIVE)
      expect(refreshed.get('metadata')).to.include({
        refund_amount: 1500,
        refund_charge_id: 'ch_refunded',
        refund_source: 'stripe_webhook'
      })
      expect(refreshed.get('metadata').refunded_at).to.be.a('string')
      expect(refreshed.get('metadata').revokedAt).to.equal(undefined)
      expect(refreshed.get('refunded_at')).to.be.an.instanceof(Date)
      expect(refreshed.get('refunded_amount')).to.equal(1500)
    }
    expect((await reload(roleAccess)).get('metadata').accessType).to.equal('role')
    expect(ContentAccess.revoke).to.not.have.been.called()
    expect(StripeService.cancelSubscription).to.not.have.been.called()

    expect(sentEmails).to.have.length(1)
    expect(sentEmails[0].email).to.equal(user.get('email'))
    expect(sentEmails[0].locale).to.equal('fr-FR')
    expect(sentEmails[0].data).to.include({
      offering_name: 'Season Pass',
      group_name: 'Garden Club',
      refund_amount_formatted: '$15.00',
      currency: 'USD',
      refund_reason: null
    })

    const logs = await refundLogs()
    expect(logs).to.have.length(1)
    expect(String(logs[0].group_id)).to.equal(String(group.id))
    expect(String(logs[0].content_access_id)).to.equal(String(groupAccess.id))
    expect(Number(logs[0].amount)).to.equal(1500)
  })

  it('sends nothing more when the same refund event is handled again', async () => {
    await connectGroup('acct_replay')
    const access = await purchase()
    const event = { ...chargeRefundedEvent, account: 'acct_replay' }

    await StripeController.handleChargeRefunded(event)
    const firstMetadata = (await reload(access)).get('metadata')
    await StripeController.handleChargeRefunded(event)

    expect(sentEmails).to.have.length(1)
    expect((await reload(access)).get('metadata').refunded_at).to.equal(firstMetadata.refunded_at)
    expect(await refundLogs()).to.have.length(1)
  })

  it('sends nothing when Hylo\'s Refund button already recorded and emailed this refund', async () => {
    const access = await purchase({
      metadata: {
        refundId: 're_button',
        refund_charge_id: 'ch_refunded',
        refunded_at: new Date().toISOString(),
        refund_source: 'hylo_refund_button'
      }
    })

    await StripeController.handleChargeRefunded(chargeRefundedEvent)

    const refreshed = await reload(access)
    expect(refreshed.get('status')).to.equal(ContentAccess.Status.ACTIVE)
    expect(refreshed.get('metadata').refund_source).to.equal('hylo_refund_button')
    expect(sentEmails).to.have.length(0)
  })

  it('sends nothing for a purchase the earlier Refund button marked refunded, and leaves the other rows active', async () => {
    await purchase({ status: ContentAccess.Status.REFUNDED, metadata: { refundId: 're_old_button' } })
    const otherAccess = await purchase()

    await StripeController.handleChargeRefunded(chargeRefundedEvent)

    expect((await reload(otherAccess)).get('status')).to.equal(ContentAccess.Status.ACTIVE)
    expect(sentEmails).to.have.length(0)
  })

  describe('for a subscription charge', () => {
    let rawRequests, invoicePaymentsFor, subscriptionAccess

    const renewalRefundEvent = {
      ...chargeRefundedEvent,
      id: 'evt_renewal_refunded',
      account: 'acct_renewal',
      data: { object: { ...chargeRefundedEvent.data.object, id: 'ch_renewal', payment_intent: 'pi_renewal' } }
    }

    beforeEach(async () => {
      await connectGroup('acct_renewal')
      subscriptionAccess = await purchase({ stripe_session_id: 'cs_subscription', stripe_subscription_id: 'sub_renewal' })
      rawRequests = []
      invoicePaymentsFor = {
        pi_renewal: { data: [{ invoice: { id: 'in_renewal', parent: { subscription_details: { subscription: 'sub_renewal' } } } }] }
      }
      stripeClient.rawRequest = async (method, path, params, options) => {
        rawRequests.push({ method, path, params, options })
        const paymentIntent = new URL(path, 'https://api.stripe.com').searchParams.get('payment[payment_intent]')
        return invoicePaymentsFor[paymentIntent] || { data: [] }
      }
    })

    afterEach(() => {
      delete stripeClient.rawRequest
    })

    it('matches a renewal refund through its invoice, records and logs it, and leaves access and the subscription alone', async () => {
      await StripeController.handleChargeRefunded(renewalRefundEvent)

      expect(rawRequests).to.have.length(1)
      expect(rawRequests[0].method).to.equal('GET')
      const params = new URL(rawRequests[0].path, 'https://api.stripe.com').searchParams
      expect(params.get('payment[type]')).to.equal('payment_intent')
      expect(params.get('payment[payment_intent]')).to.equal('pi_renewal')
      expect(rawRequests[0].options).to.deep.equal({ stripeAccount: 'acct_renewal' })

      const refreshed = await reload(subscriptionAccess)
      expect(refreshed.get('status')).to.equal(ContentAccess.Status.ACTIVE)
      expect(refreshed.get('refunded_amount')).to.equal(1500)
      expect(refreshed.get('metadata').refund_charge_id).to.equal('ch_renewal')
      expect(ContentAccess.revoke).to.not.have.been.called()
      expect(StripeService.cancelSubscription).to.not.have.been.called()
      expect(sentEmails).to.have.length(0)

      const logs = await bookshelf.knex('stripe_logs').where({ log_type: 'refund', external_id: 'ch_renewal' })
      expect(logs).to.have.length(1)
      expect(String(logs[0].content_access_id)).to.equal(String(subscriptionAccess.id))
      expect(logs[0].metadata).to.include({ matched_by: 'subscription', stripe_subscription_id: 'sub_renewal' })
    })

    it('reads the subscription from an older invoice shape too', async () => {
      invoicePaymentsFor.pi_renewal = { data: [{ invoice: { id: 'in_renewal', subscription: 'sub_renewal' } }] }

      await StripeController.handleChargeRefunded(renewalRefundEvent)

      expect(await bookshelf.knex('stripe_logs').where({ log_type: 'refund', external_id: 'ch_renewal' })).to.have.length(1)
    })

    it('logs nothing and does not throw when the charge matches no purchase', async () => {
      const access = await purchase()

      await StripeController.handleChargeRefunded({
        ...renewalRefundEvent,
        data: { object: { ...renewalRefundEvent.data.object, id: 'ch_unknown', payment_intent: 'pi_unknown' } }
      })

      expect((await reload(access)).get('status')).to.equal(ContentAccess.Status.ACTIVE)
      expect(sentEmails).to.have.length(0)
      expect(await bookshelf.knex('stripe_logs').where({ log_type: 'refund' })).to.have.length(0)
    })

    it('does not throw when the invoice lookup fails', async () => {
      stripeClient.rawRequest = async () => { throw new Error('lookup failed') }

      await StripeController.handleChargeRefunded(renewalRefundEvent)

      expect(await bookshelf.knex('stripe_logs').where({ log_type: 'refund' })).to.have.length(0)
    })
  })

  it('does nothing when no checkout session or invoice matches the payment intent', async () => {
    const access = await purchase()
    stripeClient.rawRequest = async () => ({ data: [] })

    await StripeController.handleChargeRefunded({
      ...chargeRefundedEvent,
      data: { object: { ...chargeRefundedEvent.data.object, payment_intent: 'pi_subscription_invoice' } }
    })
    delete stripeClient.rawRequest

    expect((await reload(access)).get('status')).to.equal(ContentAccess.Status.ACTIVE)
    expect(sentEmails).to.have.length(0)
  })

  it('keeps access and sends nothing for a partial refund, but still logs it', async () => {
    await connectGroup('acct_partial')
    const access = await purchase()

    await StripeController.handleChargeRefunded({
      ...chargeRefundedEvent,
      account: 'acct_partial',
      data: { object: { ...chargeRefundedEvent.data.object, amount_refunded: 500, refunded: false } }
    })

    const refreshed = await reload(access)
    expect(refreshed.get('status')).to.equal(ContentAccess.Status.ACTIVE)
    expect(refreshed.get('metadata').refunded_at).to.equal(undefined)
    expect(refreshed.get('refunded_at')).to.equal(null)
    expect(sentEmails).to.have.length(0)
    const logs = await refundLogs()
    expect(logs).to.have.length(1)
    expect(Number(logs[0].amount)).to.equal(500)
  })

  it('updates the log when the rest of a partly refunded charge is refunded', async () => {
    await connectGroup('acct_partial_then_full')
    const access = await purchase()
    const refundOf = (amountRefunded, refunded) => StripeController.handleChargeRefunded({
      ...chargeRefundedEvent,
      account: 'acct_partial_then_full',
      data: { object: { ...chargeRefundedEvent.data.object, amount_refunded: amountRefunded, refunded } }
    })

    await refundOf(500, false)
    await refundOf(1500, true)

    expect((await reload(access)).get('refunded_amount')).to.equal(1500)
    expect(sentEmails).to.have.length(1)
    const logs = await refundLogs()
    expect(logs).to.have.length(1)
    expect(Number(logs[0].amount)).to.equal(1500)
    expect(logs[0].metadata).to.include({ matched_by: 'checkout_session', full_refund: true })
    expect(String(logs[0].content_access_id)).to.equal(String(access.id))
  })
})
