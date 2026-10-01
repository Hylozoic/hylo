/* eslint-disable no-unused-expressions */
const root = require('root-path')
const { v4: uuidv4 } = require('uuid')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { dependencyOf, mockify, unspyify } = require(root('test/setup/helpers'))
const { assignAdministrator } = require(root('test/setup/roleHelpers'))
const mixpanel = require(root('lib/mixpanel'))
const { AnalyticsEvents } = require('@hylo/shared')
/* global bookshelf, ContentAccess, StripeProduct, Queue */

// Purchase and track events from the server (D62): sent to Mixpanel only for people
// who haven't turned analytics off.
describe('paid content and track events (D62)', () => {
  let StripeController, stripeMutations, stripeClient, MutationStripeService
  let accepted, rejected, steward, group, oneTime, monthly, queued, saved, originalSubscriptionRetrieve
  const now = Math.floor(Date.now() / 1000)

  const saveConsent = (user, analytics) => bookshelf.knex('cookie_consents').insert({
    consent_id: uuidv4(),
    user_id: user.id,
    settings: JSON.stringify({ analytics, support: true }),
    version: '1.0',
    created_at: new Date(),
    updated_at: new Date()
  })

  const events = name => mixpanel.track.__spy.calls
    .filter(([eventName]) => eventName === name)
    .map(([, props]) => props)
  const sentTo = name => events(name).map(props => String(props.distinct_id))

  before(async () => {
    StripeController = require(root('api/controllers/StripeController'))
    stripeMutations = require(root('api/graphql/mutations/stripe'))
    // The instance the mutations module actually uses (see dependencyOf)
    MutationStripeService = dependencyOf(root('api/graphql/mutations/stripe.js'), root('api/services/StripeService.js'))
    stripeClient = require('stripe')()
    await setup.clearDb()
    accepted = await factories.user({ name: 'Accepting Buyer' }).save()
    rejected = await factories.user({ name: 'Rejecting Buyer' }).save()
    steward = await factories.user({ name: 'Group Steward' }).save()
    await saveConsent(accepted, true)
    await saveConsent(rejected, false)
    group = await factories.group({ name: 'Garden Club' }).save()
    const stripeAccount = await factories.stripeAccount({ stripe_account_external_id: 'acct_events' }).save()
    await group.save({ stripe_account_id: stripeAccount.id }, { patch: true })
    await assignAdministrator(steward, group)
    const offering = attrs => StripeProduct.create({
      group_id: group.id,
      description: 'offering',
      price_in_cents: 1000,
      currency: 'usd',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published',
      ...attrs
    })
    oneTime = await offering({ stripe_product_id: 'prod_once', stripe_price_id: 'price_once', name: 'Season Pass', renewal_policy: 'manual', duration: 'season' })
    monthly = await offering({ stripe_product_id: 'prod_monthly', stripe_price_id: 'price_monthly', name: 'Monthly Membership', renewal_policy: 'automatic', duration: 'month' })
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    saved = { disabled: mixpanel.disabled, track: mixpanel.track }
    mixpanel.disabled = false
    mixpanel.track = spy(() => {})
    queued = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      queued.push({ className, methodName, data })
      return Promise.resolve()
    })
    originalSubscriptionRetrieve = stripeClient.subscriptions.retrieve
    stripeClient.subscriptions.retrieve = async () => ({ current_period_start: now, current_period_end: now + 30 * 24 * 60 * 60 })
  })

  afterEach(() => {
    mixpanel.disabled = saved.disabled
    mixpanel.track = saved.track
    unspyify(Queue, 'classMethod')
    stripeClient.subscriptions.retrieve = originalSubscriptionRetrieve
    delete global.__stripeWebhookConstructEvent
  })

  const session = (buyer, product, attrs = {}) => ({
    id: `cs_${buyer.id}_${product.id}_${attrs.mode || 'payment'}`,
    mode: 'payment',
    payment_status: 'paid',
    created: now,
    amount_total: 1000,
    currency: 'usd',
    metadata: { userId: String(buyer.id), groupId: String(group.id), offeringId: String(product.id) },
    ...attrs
  })
  const complete = checkoutSession => StripeController.handleCheckoutSessionCompleted({
    account: 'acct_events',
    data: { object: checkoutSession }
  })

  describe('Checkout Started', () => {
    beforeEach(() => {
      mockify(MutationStripeService, 'getPrice', async () => ({ unit_amount: 1000, currency: 'usd' }))
      mockify(MutationStripeService, 'createCheckoutSession', async () => ({ id: 'cs_started', url: 'https://checkout.example/cs_started' }))
    })

    afterEach(() => {
      unspyify(MutationStripeService, 'getPrice')
      unspyify(MutationStripeService, 'createCheckoutSession')
    })

    const start = (buyer, opts) => stripeMutations.createStripeCheckoutSession(buyer.id, {
      groupId: group.id,
      offeringId: oneTime.id,
      successUrl: 'https://www.hylo.com/success',
      cancelUrl: 'https://www.hylo.com/cancel'
    }, opts)

    it('is sent for a buyer who accepts analytics, without their email', async () => {
      await start(accepted)
      const [props] = events(AnalyticsEvents.CHECKOUT_STARTED)
      expect(props).to.include({ distinct_id: String(accepted.id), groupId: String(group.id), offeringId: String(oneTime.id), mode: 'payment' })
      expect(JSON.stringify(props)).not.to.include(accepted.get('email'))
    })

    it('is skipped for a buyer who rejected analytics, on their account or in this browser', async () => {
      await start(rejected)
      await start(accepted, { req: { cookies: { hylo_cookie_consent: JSON.stringify({ analytics: false }) } } })
      expect(events(AnalyticsEvents.CHECKOUT_STARTED)).to.have.length(0)
    })
  })

  describe('Access Granted and the new subscriber notice', () => {
    it('sends Access Granted once for a new one-time purchase, and no steward notice', async () => {
      const checkoutSession = session(accepted, oneTime)
      await complete(checkoutSession)
      await complete(checkoutSession)

      expect(sentTo(AnalyticsEvents.ACCESS_GRANTED)).to.deep.equal([String(accepted.id)])
      expect(events(AnalyticsEvents.ACCESS_GRANTED)[0]).to.include({ offeringId: String(oneTime.id), subscription: false })
      expect(queued.filter(q => q.methodName === 'sendNewSubscriberAdminNotification')).to.have.length(0)
    })

    it('skips Access Granted for a buyer who rejected analytics', async () => {
      await complete(session(rejected, oneTime))
      expect(events(AnalyticsEvents.ACCESS_GRANTED)).to.have.length(0)
    })

    it('follows up once when both grant paths finish at the same moment', async () => {
      const { afterCheckoutGrant } = require(root('lib/paidContent/afterCheckoutGrant'))
      const checkoutSession = session(accepted, monthly, { mode: 'subscription', subscription: 'sub_same_moment' })
      // What each path gets back when neither found the other's access records
      const grant = {
        granted: true,
        userId: String(accepted.id),
        groupId: String(group.id),
        offering: monthly,
        accessRecords: [],
        stripeSubscriptionId: 'sub_same_moment'
      }
      await Promise.all([afterCheckoutGrant({ grant, session: checkoutSession }), afterCheckoutGrant({ grant, session: checkoutSession })])

      expect(queued.filter(q => q.methodName === 'sendNewSubscriberAdminNotification')).to.have.length(1)
      expect(sentTo(AnalyticsEvents.ACCESS_GRANTED)).to.deep.equal([String(accepted.id)])
      const logs = await bookshelf.knex('stripe_logs').where({ log_type: 'checkout_granted', external_id: checkoutSession.id })
      expect(logs).to.have.length(1)
      expect(logs[0].metadata).to.deep.equal({ offering_id: String(monthly.id), mode: 'subscription' })
    })

    it('tells the group\'s Administrators about a new subscriber, once, even when the success page granted first', async () => {
      const checkoutSession = session(rejected, monthly, { mode: 'subscription', subscription: 'sub_new_subscriber' })
      mockify(MutationStripeService, 'getCheckoutSession', async () => checkoutSession)
      try {
        await stripeMutations.fulfillStripeCheckoutSession(rejected.id, { sessionId: checkoutSession.id, offeringId: monthly.id })
      } finally {
        unspyify(MutationStripeService, 'getCheckoutSession')
      }
      await complete(checkoutSession)

      const notices = queued.filter(q => q.methodName === 'sendNewSubscriberAdminNotification')
      expect(notices).to.have.length(1)
      expect(notices[0].className).to.equal('Email')
      expect(notices[0].data.email).to.equal(steward.get('email'))
      expect(notices[0].data.data).to.include({
        user_name: 'Rejecting Buyer',
        offering_name: 'Monthly Membership',
        group_name: 'Garden Club',
        subscription_amount: '$10.00',
        subscription_period: 'monthly'
      })
      expect(JSON.stringify(notices[0].data)).not.to.include(rejected.get('email'))
      // The subscriber turned analytics off; stewards still hear about them
      expect(events(AnalyticsEvents.ACCESS_GRANTED)).to.have.length(0)
    })
  })

  describe('subscription lifecycle', () => {
    let access

    beforeEach(async () => {
      await bookshelf.knex('content_access').where({ stripe_subscription_id: 'sub_lifecycle' }).del()
      access = buyer => ContentAccess.create({
        user_id: buyer.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        product_id: monthly.id,
        access_type: ContentAccess.Type.STRIPE_PURCHASE,
        stripe_session_id: `cs_lifecycle_${buyer.id}`,
        stripe_subscription_id: 'sub_lifecycle',
        status: ContentAccess.Status.ACTIVE
      })
    })

    for (const [label, buyerOf] of [['accepts', () => accepted], ['rejected', () => rejected]]) {
      it(`sends renewal, payment failure and cancellation events only when the subscriber ${label} analytics`, async () => {
        const buyer = buyerOf()
        await access(buyer)
        await StripeController.handleInvoicePaid({
          data: { object: { id: 'in_renewed', subscription: 'sub_lifecycle', billing_reason: 'subscription_cycle', amount_paid: 1000, currency: 'usd', created: now } }
        })
        await StripeController.handleInvoicePaymentFailed({
          data: { object: { id: 'in_failed', subscription: 'sub_lifecycle', attempt_count: 2, last_payment_error: { message: 'Card declined' } } }
        })
        await StripeController.handleSubscriptionDeleted({
          data: { object: { id: 'sub_lifecycle', cancellation_details: { reason: 'cancellation_requested', feedback: 'too expensive' } } }
        })

        const expected = buyer === accepted ? [String(buyer.id)] : []
        expect(sentTo(AnalyticsEvents.SUBSCRIPTION_RENEWED)).to.deep.equal(expected)
        expect(sentTo(AnalyticsEvents.PAYMENT_FAILED)).to.deep.equal(expected)
        expect(sentTo(AnalyticsEvents.SUBSCRIPTION_CANCELLED)).to.deep.equal(expected)
        if (buyer === accepted) {
          expect(events(AnalyticsEvents.PAYMENT_FAILED)[0]).to.include({ attemptCount: 2, offeringId: String(monthly.id) })
          const [cancelled] = events(AnalyticsEvents.SUBSCRIPTION_CANCELLED)
          expect(cancelled.reason).to.equal('cancellation_requested')
          expect(JSON.stringify(cancelled)).not.to.include('too expensive')
        }
      })
    }
  })

  describe('the cancellation notice the new subscriber notice matches', () => {
    it('reaches the group\'s Administrators', async () => {
      await ContentAccess.create({
        user_id: accepted.id,
        granted_by_group_id: group.id,
        group_id: group.id,
        product_id: monthly.id,
        access_type: ContentAccess.Type.STRIPE_PURCHASE,
        stripe_session_id: 'cs_cancel_notice',
        stripe_subscription_id: 'sub_cancel_notice',
        status: ContentAccess.Status.ACTIVE
      })
      await StripeController.handleSubscriptionDeleted({ data: { object: { id: 'sub_cancel_notice' } } })

      const notices = queued.filter(q => q.methodName === 'sendSubscriptionCancelledAdminNotification')
      expect(notices.map(q => q.data.email)).to.deep.equal([steward.get('email')])
      expect(notices[0].data.data.admin_name).to.equal('Group Steward')
    })
  })

  describe('checkout.session.expired', () => {
    it('logs the unfinished checkout for the selling group without the customer\'s email', async () => {
      global.__stripeWebhookConstructEvent = () => ({
        id: 'evt_expired',
        type: 'checkout.session.expired',
        account: 'acct_events',
        data: {
          object: {
            id: 'cs_expired',
            status: 'expired',
            mode: 'payment',
            amount_total: 1000,
            currency: 'usd',
            customer_email: 'buyer@example.com',
            customer_details: { email: 'buyer@example.com', name: 'Someone' },
            metadata: { userId: String(accepted.id), groupId: String(group.id), offeringId: String(oneTime.id) }
          }
        }
      })
      const req = factories.mock.request()
      const res = factories.mock.response()
      req.body = Buffer.from('fake-body')
      req.headers['stripe-signature'] = 'sig_test'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

      await StripeController.webhook(req, res)

      expect(res.body.received).to.equal(true)
      const logs = await bookshelf.knex('stripe_logs').where({ log_type: 'checkout_expired', external_id: 'cs_expired' })
      expect(logs).to.have.length(1)
      expect(String(logs[0].group_id)).to.equal(String(group.id))
      expect(logs[0].amount).to.equal(1000)
      expect(logs[0].metadata).to.deep.equal({ offering_id: String(oneTime.id), mode: 'payment' })
      expect(JSON.stringify(logs[0])).not.to.include('buyer@example.com')
    })
  })

  describe('tracks', () => {
    let space, track, action

    before(async () => {
      const { createTrack } = require(root('api/graphql/mutations/track'))
      space = await factories.group({ type: 'space', parent_id: group.id, slug: `events-track-${Date.now()}` }).save()
      await Group.setupSpaceViews(space.id, [], ['track-actions'])
      track = await createTrack(steward.id, { groupId: space.id })
      action = await factories.post({ type: 'action', user_id: steward.id }).save()
      await action.groups().attach([space.id])
      await Track.addPost(action, await Track.find(track.id))
      for (const user of [accepted, rejected]) await group.addMembers([user.id])
    })

    it('sends Track Enrolled and Track Completed only for learners who accept analytics', async () => {
      for (const learner of [accepted, rejected]) {
        await Track.enroll(track.id, learner.id)
        await action.complete(learner.id, JSON.stringify(['done']))
        await Post.checkCompletedTrack({ userId: learner.id, postId: action.id })
      }

      expect(sentTo(AnalyticsEvents.TRACK_ENROLLED)).to.deep.equal([String(accepted.id)])
      expect(events(AnalyticsEvents.TRACK_ENROLLED)[0]).to.include({ trackId: String(track.id), groupId: String(group.id), joinSource: 'track' })
      expect(sentTo(AnalyticsEvents.TRACK_COMPLETED)).to.deep.equal([String(accepted.id)])
      expect(events(AnalyticsEvents.TRACK_COMPLETED)[0]).to.include({ trackId: String(track.id), groupId: String(group.id) })
    })
  })
})
