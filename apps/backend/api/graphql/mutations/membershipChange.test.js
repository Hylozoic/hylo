/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import mock from 'mock-require'
const { expect } = require('chai')
const { resolvePeriodPriceCentsForCredit } = require('../../../lib/membershipChangeCredit')

/* global StripeProduct, ContentAccess, SubscriptionChangeEvent */

let lastUpdatePriceArgs = null
let lastUpdateQuantityArgs = null
let lastSchedulePriceArgs = null
let lastCancelSubscriptionArgs = null
let lastBalanceCreditArgs = null
let mockSubscriptionStatus = 'active'
let shouldFailStripeUpdate = false
let mockZeroCreditPeriod = false

const mockStripeService = {
  getSubscription: async (accountId, subscriptionId) => {
    const now = Math.floor(Date.now() / 1000)
    const period = mockZeroCreditPeriod
      ? { current_period_start: now - 86400 * 60, current_period_end: now - 86400 }
      : { current_period_start: now - 15 * 86400, current_period_end: now + 15 * 86400 }
    return {
      id: subscriptionId,
      status: mockSubscriptionStatus,
      customer: 'cus_test_123',
      metadata: {},
      ...period,
      items: {
        data: [{
          id: 'si_item_test',
          quantity: 1,
          price: { id: 'price_from', unit_amount: 1000 }
        }]
      }
    }
  },
  createCustomerBalanceCredit: async (params) => {
    lastBalanceCreditArgs = params
    return { id: 'cbtxn_test' }
  },
  resolvePrimaryItemPeriodPriceCents: async ({ subscription, fromProduct }) =>
    resolvePeriodPriceCentsForCredit(subscription, fromProduct),
  updateSubscriptionPrimaryItemPrice: async (params) => {
    if (shouldFailStripeUpdate) {
      throw new Error('Stripe API error')
    }
    lastUpdatePriceArgs = params
    return { id: params.subscriptionId, status: 'active' }
  },
  updateSubscriptionPrimaryItemQuantity: async (params) => {
    if (shouldFailStripeUpdate) {
      throw new Error('Stripe API error')
    }
    lastUpdateQuantityArgs = params
    return { id: params.subscriptionId, status: 'active' }
  },
  scheduleSubscriptionPrimaryItemPriceAtPeriodEnd: async (params) => {
    if (shouldFailStripeUpdate) {
      throw new Error('Stripe API error')
    }
    lastSchedulePriceArgs = params
    return { id: 'sub_sched_test' }
  },
  cancelSubscription: async (params) => {
    if (shouldFailStripeUpdate) {
      throw new Error('Stripe API error')
    }
    lastCancelSubscriptionArgs = params
    return {
      id: params.subscriptionId,
      cancel_at_period_end: true
    }
  }
}

mock('../../services/StripeService', mockStripeService)

const { membershipChangeCommit } = mock.reRequire('./membershipChange')

/**
 * Creates a recurring monthly offering for the group (membership change eligible).
 */
async function createMonthlyOffering (group, {
  name,
  priceInCents,
  stripePriceId,
  currency = 'usd',
  duration = 'month',
  renewalPolicy = 'automatic',
  accessGrants,
  metadata
}) {
  return StripeProduct.create({
    group_id: group.id,
    stripe_product_id: `prod_${name}`,
    stripe_price_id: stripePriceId,
    name,
    description: 'Test offering',
    price_in_cents: priceInCents,
    currency,
    renewal_policy: renewalPolicy,
    duration,
    access_grants: accessGrants || { groupIds: [group.id] },
    metadata: metadata || {},
    publish_status: 'published'
  })
}

/**
 * Active subscription-backed content_access for membership change.
 */
async function grantSubscriptionAccess (user, group, product, subscriptionId = 'sub_test_123') {
  return ContentAccess.create({
    user_id: user.id,
    granted_by_group_id: group.id,
    group_id: group.id,
    product_id: product.id,
    access_type: ContentAccess.Type.STRIPE_PURCHASE,
    stripe_session_id: 'cs_test',
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: 'cus_test_123',
    status: ContentAccess.Status.ACTIVE
  })
}

describe('membershipChangeCommit', () => {
  let user, group, stripeAccount

  before(async () => {
    user = await factories.user().save()
    group = await factories.group().save()
    await user.joinGroup(group)
    stripeAccount = await factories.stripeAccount({
      stripe_account_external_id: 'acct_test_membership'
    }).save()
    await group.save({ stripe_account_id: stripeAccount.id })
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    lastUpdatePriceArgs = null
    lastUpdateQuantityArgs = null
    lastSchedulePriceArgs = null
    lastCancelSubscriptionArgs = null
    lastBalanceCreditArgs = null
    mockSubscriptionStatus = 'active'
    shouldFailStripeUpdate = false
    mockZeroCreditPeriod = false
  })

  it('rejects when user is not logged in', async () => {
    await expect(
      membershipChangeCommit(null, {
        groupId: group.id,
        fromOfferingId: '1',
        toOfferingId: '2'
      })
    ).to.be.rejectedWith('You must be logged in')
  })

  it('rejects when user is not a group member', async () => {
    const otherUser = await factories.user().save()

    await expect(
      membershipChangeCommit(otherUser.id, {
        groupId: group.id,
        fromOfferingId: '1',
        toOfferingId: '2'
      })
    ).to.be.rejectedWith('You must be a member of this group')
  })

  it('rejects when there is no active subscription content_access', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From A',
      priceInCents: 1000,
      stripePriceId: 'price_from_a'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To B',
      priceInCents: 2000,
      stripePriceId: 'price_to_b'
    })

    await expect(
      membershipChangeCommit(user.id, {
        groupId: group.id,
        fromOfferingId: String(fromP.id),
        toOfferingId: String(toP.id)
      })
    ).to.be.rejectedWith('No active subscription found for this membership offering')
  })

  it('rejects when group has no Stripe account', async () => {
    const g = await factories.group().save()
    await user.joinGroup(g)
    const fromP = await createMonthlyOffering(g, {
      name: 'From C',
      priceInCents: 1000,
      stripePriceId: 'price_from_c'
    })
    const toP = await createMonthlyOffering(g, {
      name: 'To D',
      priceInCents: 2000,
      stripePriceId: 'price_to_d'
    })
    await grantSubscriptionAccess(user, g, fromP)

    await expect(
      membershipChangeCommit(user.id, {
        groupId: g.id,
        fromOfferingId: String(fromP.id),
        toOfferingId: String(toP.id)
      })
    ).to.be.rejectedWith('Group does not have a connected Stripe account')
  })

  it('applies immediate upgrade with Hylo prepaid credit and billing anchor reset', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From Low',
      priceInCents: 1000,
      stripePriceId: 'price_from_low'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To High',
      priceInCents: 5000,
      stripePriceId: 'price_to_high'
    })
    await grantSubscriptionAccess(user, group, fromP)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(fromP.id),
      toOfferingId: String(toP.id)
    })

    expect(result.success).to.be.true
    expect(result.mode).to.equal('immediate_upgrade')
    expect(lastBalanceCreditArgs).to.not.equal(null)
    expect(lastBalanceCreditArgs.amountCents).to.equal(500)
    expect(lastBalanceCreditArgs.currency).to.equal('usd')
    expect(lastUpdatePriceArgs).to.not.equal(null)
    expect(lastUpdatePriceArgs.newPriceId).to.equal('price_to_high')
    expect(lastUpdatePriceArgs.prorationBehavior).to.equal('none')
    expect(lastUpdatePriceArgs.billingCycleAnchor).to.equal('now')
    expect(lastUpdatePriceArgs.accountId).to.equal('acct_test_membership')
    expect(lastUpdateQuantityArgs).to.equal(null)

    const evt = await SubscriptionChangeEvent.where({ id: result.subscriptionChangeEventId }).fetch()
    expect(evt.get('status')).to.equal('applied')
    expect(evt.get('stripe_subscription_id')).to.equal('sub_test_123')
    const payload = evt.get('payload') || {}
    expect(payload.hyloPrepaidCreditCents).to.equal(500)
  })

  it('applies sliding-scale quantity change on same offering', async () => {
    const offering = await createMonthlyOffering(group, {
      name: 'Sliding',
      priceInCents: 1000,
      stripePriceId: 'price_sliding',
      metadata: {
        slidingScale: { enabled: true, minimum: 1, maximum: 10 }
      }
    })
    await grantSubscriptionAccess(user, group, offering)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(offering.id),
      toOfferingId: String(offering.id),
      newQuantity: 4
    })

    expect(result.success).to.be.true
    expect(result.mode).to.equal('sliding_scale_next_cycle')
    expect(lastUpdateQuantityArgs).to.not.equal(null)
    expect(lastUpdateQuantityArgs.quantity).to.equal(4)
    expect(lastUpdateQuantityArgs.prorationBehavior).to.equal('none')
    expect(lastUpdatePriceArgs).to.equal(null)

    const evt = await SubscriptionChangeEvent.where({ id: result.subscriptionChangeEventId }).fetch()
    const payload = evt.get('payload') || {}
    expect(payload.targetStripePriceId).to.equal('price_sliding')
    expect(payload.targetQuantity).to.equal(4)
  })

  it('accepts quantity when switching to a different sliding-scale offering', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From Fixed',
      priceInCents: 1000,
      stripePriceId: 'price_from_fixed'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To Sliding',
      priceInCents: 1200,
      stripePriceId: 'price_to_sliding',
      metadata: {
        slidingScale: { enabled: true, minimum: 2, maximum: 8 }
      }
    })
    await grantSubscriptionAccess(user, group, fromP)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(fromP.id),
      toOfferingId: String(toP.id),
      newQuantity: 3
    })

    expect(result.success).to.equal(true)
    expect(result.mode).to.equal('immediate_upgrade')
    expect(lastUpdatePriceArgs).to.not.equal(null)
    expect(lastUpdatePriceArgs.quantity).to.equal(3)
  })

  it('schedules downgrade (same period, lower price) at period end', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From High',
      priceInCents: 5000,
      stripePriceId: 'price_from_high'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To Low',
      priceInCents: 1000,
      stripePriceId: 'price_to_low'
    })
    await grantSubscriptionAccess(user, group, fromP)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(fromP.id),
      toOfferingId: String(toP.id)
    })
    expect(result.success).to.equal(true)
    expect(result.mode).to.equal('scheduled_period_end')
    expect(lastSchedulePriceArgs).to.not.equal(null)
    expect(lastSchedulePriceArgs.newPriceId).to.equal('price_to_low')

    const evt = await SubscriptionChangeEvent.where({ id: result.subscriptionChangeEventId }).fetch()
    expect(evt.get('status')).to.equal('pending')
    expect(evt.get('pending_effective_at')).to.exist
    const payload = evt.get('payload') || {}
    expect(payload.targetStripePriceId).to.equal('price_to_low')
    expect(payload.targetQuantity).to.equal(null)
  })

  it('rejects currency mismatch changes', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From USD',
      priceInCents: 2000,
      stripePriceId: 'price_from_usd',
      currency: 'usd'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To EUR',
      priceInCents: 2500,
      stripePriceId: 'price_to_eur',
      currency: 'eur'
    })
    await grantSubscriptionAccess(user, group, fromP)

    await expect(
      membershipChangeCommit(user.id, {
        groupId: group.id,
        fromOfferingId: String(fromP.id),
        toOfferingId: String(toP.id)
      })
    ).to.be.rejectedWith('Cannot switch between plans with different currencies')
    expect(lastSchedulePriceArgs).to.equal(null)
  })

  it('handles lifetime change with no proration by canceling current subscription at period end', async () => {
    const fromP = await createMonthlyOffering(group, {
      name: 'From Recurring',
      priceInCents: 2000,
      stripePriceId: 'price_from_rec'
    })
    const lifetime = await createMonthlyOffering(group, {
      name: 'Lifetime',
      priceInCents: 15000,
      stripePriceId: 'price_lifetime',
      duration: 'lifetime',
      renewalPolicy: 'manual'
    })
    await grantSubscriptionAccess(user, group, fromP)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(fromP.id),
      toOfferingId: String(lifetime.id)
    })

    expect(result.success).to.equal(true)
    expect(result.mode).to.equal('lifetime_no_proration')
    expect(lastCancelSubscriptionArgs).to.deep.equal({
      accountId: 'acct_test_membership',
      subscriptionId: 'sub_test_123',
      immediately: false
    })

    const evt = await SubscriptionChangeEvent.where({ id: result.subscriptionChangeEventId }).fetch()
    expect(evt.get('status')).to.equal('pending')
    expect(evt.get('pending_effective_at')).to.exist
    const payload = evt.get('payload') || {}
    expect(payload.scheduledCancellationAtPeriodEnd).to.equal(true)
    expect(payload.requiresLifetimeCheckout).to.equal(true)
  })

  it('past_due: same immediate-upgrade path (credit + anchor reset, no Stripe proration)', async () => {
    mockSubscriptionStatus = 'past_due'

    const fromP = await createMonthlyOffering(group, {
      name: 'From PD',
      priceInCents: 1000,
      stripePriceId: 'price_from_pd'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To PD',
      priceInCents: 3000,
      stripePriceId: 'price_to_pd'
    })
    await grantSubscriptionAccess(user, group, fromP)

    const result = await membershipChangeCommit(user.id, {
      groupId: group.id,
      fromOfferingId: String(fromP.id),
      toOfferingId: String(toP.id)
    })

    expect(result.success).to.be.true
    expect(result.mode).to.equal('past_due_no_proration')
    expect(lastUpdatePriceArgs.prorationBehavior).to.equal('none')
    expect(lastUpdatePriceArgs.billingCycleAnchor).to.equal('now')
    expect(lastUpdatePriceArgs.newPriceId).to.equal('price_to_pd')
    expect(lastBalanceCreditArgs).to.not.equal(null)
  })

  it('marks subscription_change_events failed and rethrows when Stripe update fails', async () => {
    mockZeroCreditPeriod = true
    shouldFailStripeUpdate = true

    const fromP = await createMonthlyOffering(group, {
      name: 'From Fail',
      priceInCents: 1000,
      stripePriceId: 'price_from_fail'
    })
    const toP = await createMonthlyOffering(group, {
      name: 'To Fail',
      priceInCents: 8000,
      stripePriceId: 'price_to_fail'
    })
    await grantSubscriptionAccess(user, group, fromP)

    await expect(
      membershipChangeCommit(user.id, {
        groupId: group.id,
        fromOfferingId: String(fromP.id),
        toOfferingId: String(toP.id)
      })
    ).to.be.rejectedWith('Stripe API error')

    const failed = await SubscriptionChangeEvent.query(function (qb) {
      qb.where({ user_id: user.id, group_id: group.id, status: 'failed' })
    }).fetchAll()
    expect(failed.length).to.be.at.least(1)
    expect(failed.first().get('error_message')).to.equal('Stripe API error')
  })

  it('rejects same offering without newQuantity when sliding scale is not enabled', async () => {
    const offering = await createMonthlyOffering(group, {
      name: 'No Slide',
      priceInCents: 1000,
      stripePriceId: 'price_no_slide'
    })
    await grantSubscriptionAccess(user, group, offering)

    await expect(
      membershipChangeCommit(user.id, {
        groupId: group.id,
        fromOfferingId: String(offering.id),
        toOfferingId: String(offering.id)
      })
    ).to.be.rejectedWith('Same offering requires newQuantity when sliding scale is enabled')
  })
})
