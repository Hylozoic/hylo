/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import mock from 'mock-require'
const { expect } = require('chai')
const { resolvePeriodPriceCentsForCredit } = require('../../../lib/membershipChangeCredit')

/* global GroupMembership, StripeProduct, ContentAccess */

let lastPreviewArgs = null
const mockStripeService = {
  getSubscription: async () => {
    const now = Math.floor(Date.now() / 1000)
    return {
      current_period_start: now - 15 * 86400,
      current_period_end: now + 15 * 86400,
      customer: 'cus_mq_123',
      items: { data: [{ id: 'si_mq', quantity: 1, price: { unit_amount: 1000 } }] }
    }
  },
  resolvePrimaryItemPeriodPriceCents: async ({ subscription, fromProduct }) =>
    resolvePeriodPriceCentsForCredit(subscription, fromProduct),
  previewMembershipImmediateUpgradeWithHyloCredit: async (args) => {
    lastPreviewArgs = args
    return {
      invoice: {
        amount_due: 4500,
        currency: 'usd',
        subtotal: 5000,
        total: 5000,
        next_payment_attempt: 1735689600,
        lines: {
          data: [
            {
              description: 'Unused prepaid time (prior membership offering)',
              amount: -500,
              currency: 'usd',
              proration: false
            },
            { description: 'New plan (1 × period)', amount: 5000, currency: 'usd', proration: false }
          ]
        }
      },
      manualCreditCents: null
    }
  }
}

mock('../../services/StripeService', mockStripeService)

const {
  membershipChangeEligibleOfferings,
  membershipChangePreview,
  membershipChangeInvoicePreview
} = mock.reRequire('./membershipChange')

describe('Membership Change Queries', () => {
  let user, group, stripeAccount

  before(async () => {
    user = await factories.user().save()
    group = await factories.group().save()
    await user.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    stripeAccount = await factories.stripeAccount({
      stripe_account_external_id: 'acct_test_membership_queries'
    }).save()
    await group.save({ stripe_account_id: stripeAccount.id })
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    lastPreviewArgs = null
  })

  it('returns recurring eligible offerings for the group', async () => {
    const monthly = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_month',
      stripe_price_id: 'price_mq_month',
      name: 'Monthly',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })

    await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_life',
      stripe_price_id: 'price_mq_life',
      name: 'Lifetime',
      price_in_cents: 15000,
      currency: 'usd',
      renewal_policy: 'manual',
      duration: 'lifetime',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })

    const result = await membershipChangeEligibleOfferings(user.id, { groupId: String(group.id) })
    expect(result.success).to.equal(true)
    expect(result.offerings.map(o => o.id)).to.include(monthly.id)
  })

  it('returns mode preview for two offerings', async () => {
    const fromOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_from',
      stripe_price_id: 'price_mq_from',
      name: 'From',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    const toOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_to',
      stripe_price_id: 'price_mq_to',
      name: 'To',
      price_in_cents: 5000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })

    const result = await membershipChangePreview(user.id, {
      groupId: String(group.id),
      fromOfferingId: String(fromOffering.id),
      toOfferingId: String(toOffering.id)
    })
    expect(result.mode).to.equal('immediate_upgrade')
  })

  it('returns invoice preview for immediate_upgrade mode', async () => {
    const fromOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_invoice_from',
      stripe_price_id: 'price_mq_invoice_from',
      name: 'From Invoice',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    const toOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_invoice_to',
      stripe_price_id: 'price_mq_invoice_to',
      name: 'To Invoice',
      price_in_cents: 5000,
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
      product_id: fromOffering.id,
      access_type: ContentAccess.Type.STRIPE_PURCHASE,
      stripe_session_id: 'cs_mq_1',
      stripe_subscription_id: 'sub_mq_123',
      stripe_customer_id: 'cus_mq_123',
      status: ContentAccess.Status.ACTIVE
    })

    const result = await membershipChangeInvoicePreview(user.id, {
      groupId: String(group.id),
      fromOfferingId: String(fromOffering.id),
      toOfferingId: String(toOffering.id)
    })

    expect(result.mode).to.equal('immediate_upgrade')
    expect(result.amountDue).to.equal(4500)
    expect(result.currency).to.equal('usd')
    expect(result.hyloPrepaidCreditCents).to.equal(500)
    expect(result.lines).to.have.length(2)
    expect(lastPreviewArgs).to.deep.equal({
      accountId: 'acct_test_membership_queries',
      subscriptionId: 'sub_mq_123',
      newPriceId: 'price_mq_invoice_to',
      creditCents: 500,
      currency: 'usd'
    })
  })

  it('returns null pricing fields for non-immediate modes', async () => {
    const fromOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_sched_from',
      stripe_price_id: 'price_mq_sched_from',
      name: 'From Scheduled',
      price_in_cents: 5000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })
    const toOffering = await StripeProduct.create({
      group_id: group.id,
      stripe_product_id: 'prod_mq_sched_to',
      stripe_price_id: 'price_mq_sched_to',
      name: 'To Scheduled',
      price_in_cents: 1000,
      currency: 'usd',
      renewal_policy: 'automatic',
      duration: 'month',
      access_grants: { groupIds: [group.id] },
      publish_status: 'published'
    })

    const result = await membershipChangeInvoicePreview(user.id, {
      groupId: String(group.id),
      fromOfferingId: String(fromOffering.id),
      toOfferingId: String(toOffering.id)
    })

    expect(result.mode).to.equal('scheduled_period_end')
    expect(result.amountDue).to.equal(null)
    expect(result.lines).to.deep.equal([])
    expect(lastPreviewArgs).to.equal(null)
  })
})
