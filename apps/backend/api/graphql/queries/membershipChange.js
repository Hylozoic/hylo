/**
 * GraphQL queries for subscription change (v1): eligible offerings and rule preview.
 */

const { GraphQLError } = require('graphql')
const StripeService = require('../../services/StripeService')
const { resolveSubscriptionChangeMode } = require('../../../lib/subscriptionChangeRules')
const {
  productGrantsGroupAccess,
  isRecurringSubscriptionOffering,
  isLifetimeOrOneTimeOffering
} = require('../../../lib/membershipOfferingEligibility')
const { computeHyloUnusedPrepaidCreditCents } = require('../../../lib/membershipChangeCredit')

/* global StripeProduct, GroupMembership, ContentAccess, Group, StripeAccount */

async function getExternalAccountId (accountId) {
  if (accountId && String(accountId).startsWith('acct_')) {
    return accountId
  }

  const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
  if (!stripeAccount) {
    throw new GraphQLError('Stripe account record not found')
  }
  return stripeAccount.get('stripe_account_external_id')
}

async function findMembershipSubscriptionAccess (userId, groupId, productId) {
  const uid = parseInt(userId, 10)
  const gid = parseInt(groupId, 10)
  const pid = parseInt(productId, 10)
  if (isNaN(uid) || isNaN(gid) || isNaN(pid)) {
    return null
  }

  const rows = await ContentAccess.query(function (qb) {
    qb.where({ user_id: uid, product_id: pid })
    qb.whereNotNull('stripe_subscription_id')
    qb.where(function () {
      this.where('group_id', gid).orWhere('granted_by_group_id', gid)
    })
    qb.where('status', ContentAccess.Status.ACTIVE)
  }).fetchAll()

  if (!rows.length) return null
  const subIds = [...new Set(rows.models.map(r => r.get('stripe_subscription_id')).filter(Boolean))]
  if (subIds.length !== 1) {
    throw new GraphQLError('Multiple active subscriptions found for this membership; contact support.')
  }
  return rows.first()
}

/**
 * Published recurring offerings that grant access to the group (membership change targets).
 * Excludes `day` duration (test-only).
 *
 * @param {string|number|null} userId
 * @param {{ groupId: string }} args
 */
async function membershipChangeEligibleOfferings (userId, { groupId }) {
  if (!userId) {
    throw new GraphQLError('You must be logged in')
  }

  const hasMembership = await GroupMembership.hasActiveMembership(userId, groupId)
  if (!hasMembership) {
    throw new GraphQLError('You must be a member of this group')
  }

  const products = await StripeProduct.where({
    group_id: groupId,
    publish_status: 'published'
  }).fetchAll()

  const eligible = products.models.filter((product) => {
    if (!isRecurringSubscriptionOffering(product, { includeDayDuration: false })) {
      return false
    }
    return productGrantsGroupAccess(product, groupId)
  })

  return {
    offerings: eligible,
    success: true
  }
}

/**
 * Resolve change mode from two offerings (DB-only; optional isPastDue from Stripe later).
 *
 * @param {string|number|null} userId
 * @param {{ groupId: string, fromOfferingId: string, toOfferingId: string, isPastDue?: boolean, isSlidingScaleQuantityOnly?: boolean }} args
 */
async function membershipChangePreview (userId, {
  groupId,
  fromOfferingId,
  toOfferingId,
  isPastDue = false,
  isSlidingScaleQuantityOnly = false
}) {
  if (!userId) {
    throw new GraphQLError('You must be logged in')
  }

  const hasMembership = await GroupMembership.hasActiveMembership(userId, groupId)
  if (!hasMembership) {
    throw new GraphQLError('You must be a member of this group')
  }

  const fromProduct = await StripeProduct.where({ id: fromOfferingId }).fetch()
  const toProduct = await StripeProduct.where({ id: toOfferingId }).fetch()

  if (!fromProduct || !toProduct) {
    throw new GraphQLError('Offering not found')
  }

  if (parseInt(fromProduct.get('group_id'), 10) !== parseInt(groupId, 10) ||
      parseInt(toProduct.get('group_id'), 10) !== parseInt(groupId, 10)) {
    throw new GraphQLError('Offerings must belong to this group')
  }

  const targetIsLifetime = isLifetimeOrOneTimeOffering(toProduct)

  const result = resolveSubscriptionChangeMode({
    isPastDue: !!isPastDue,
    isSlidingScaleQuantityOnly: !!isSlidingScaleQuantityOnly,
    targetIsLifetime,
    currentDuration: fromProduct.get('duration'),
    targetDuration: toProduct.get('duration'),
    currentPriceCents: fromProduct.get('price_in_cents') || 0,
    targetPriceCents: toProduct.get('price_in_cents') || 0,
    currentCurrency: fromProduct.get('currency') || 'usd',
    targetCurrency: toProduct.get('currency') || 'usd'
  })

  return {
    mode: result.mode,
    reason: result.reason,
    meta: result.meta || null
  }
}

/**
 * Preview upcoming invoice for immediate-upgrade membership changes.
 */
async function membershipChangeInvoicePreview (userId, {
  groupId,
  fromOfferingId,
  toOfferingId
}) {
  if (!userId) {
    throw new GraphQLError('You must be logged in')
  }

  const hasMembership = await GroupMembership.hasActiveMembership(userId, groupId)
  if (!hasMembership) {
    throw new GraphQLError('You must be a member of this group')
  }

  const fromProduct = await StripeProduct.where({ id: fromOfferingId }).fetch()
  const toProduct = await StripeProduct.where({ id: toOfferingId }).fetch()
  if (!fromProduct || !toProduct) {
    throw new GraphQLError('Offering not found')
  }

  if (parseInt(fromProduct.get('group_id'), 10) !== parseInt(groupId, 10) ||
      parseInt(toProduct.get('group_id'), 10) !== parseInt(groupId, 10)) {
    throw new GraphQLError('Offerings must belong to this group')
  }

  const targetIsLifetime = isLifetimeOrOneTimeOffering(toProduct)
  const modeResult = resolveSubscriptionChangeMode({
    isPastDue: false,
    isSlidingScaleQuantityOnly: false,
    targetIsLifetime,
    currentDuration: fromProduct.get('duration'),
    targetDuration: toProduct.get('duration'),
    currentPriceCents: fromProduct.get('price_in_cents') || 0,
    targetPriceCents: toProduct.get('price_in_cents') || 0,
    currentCurrency: fromProduct.get('currency') || 'usd',
    targetCurrency: toProduct.get('currency') || 'usd'
  })

  if (modeResult.mode !== 'immediate_upgrade') {
    return {
      mode: modeResult.mode,
      reason: modeResult.reason,
      amountDue: null,
      currency: null,
      subtotal: null,
      total: null,
      nextPaymentAttempt: null,
      lines: [],
      hyloPrepaidCreditCents: null
    }
  }

  const access = await findMembershipSubscriptionAccess(userId, groupId, fromOfferingId)
  if (!access) {
    throw new GraphQLError('No active subscription found for this membership offering')
  }

  const group = await Group.find(groupId)
  if (!group || !group.get('stripe_account_id')) {
    throw new GraphQLError('Group does not have a connected Stripe account')
  }
  const externalAccountId = await getExternalAccountId(group.get('stripe_account_id'))
  const subscriptionId = access.get('stripe_subscription_id')

  const subscription = await StripeService.getSubscription(externalAccountId, subscriptionId)
  const periodPriceCents = await StripeService.resolvePrimaryItemPeriodPriceCents({
    accountId: externalAccountId,
    subscription,
    fromProduct
  })
  const creditCents = computeHyloUnusedPrepaidCreditCents(subscription, fromProduct, undefined, periodPriceCents)

  const { invoice, manualCreditCents } = await StripeService.previewMembershipImmediateUpgradeWithHyloCredit({
    accountId: externalAccountId,
    subscriptionId,
    newPriceId: toProduct.get('stripe_price_id'),
    creditCents,
    currency: fromProduct.get('currency') || 'usd'
  })

  const invCur = invoice.currency || fromProduct.get('currency') || 'usd'
  let lines = (invoice.lines?.data || []).map(line => {
    const prorationFromParent = !!line.parent?.subscription_item_details?.proration
    return {
      description: line.description || null,
      amount: line.amount != null ? line.amount : 0,
      currency: line.currency || invCur || null,
      proration: !!line.proration || prorationFromParent
    }
  })

  let amountDue = invoice.amount_due != null ? invoice.amount_due : null
  if (manualCreditCents != null && manualCreditCents > 0) {
    lines = [
      ...lines,
      {
        description: 'Unused prepaid time (prior membership offering)',
        amount: -manualCreditCents,
        currency: invCur,
        proration: false
      }
    ]
    const baseDue = invoice.amount_due != null ? invoice.amount_due : (invoice.total != null ? invoice.total : 0)
    amountDue = Math.max(0, baseDue - manualCreditCents)
  }

  return {
    mode: modeResult.mode,
    reason: modeResult.reason,
    amountDue,
    currency: invCur,
    subtotal: invoice.subtotal != null ? invoice.subtotal : null,
    total: invoice.total != null ? invoice.total : null,
    nextPaymentAttempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null,
    lines,
    hyloPrepaidCreditCents: creditCents
  }
}

module.exports = {
  membershipChangeEligibleOfferings,
  membershipChangePreview,
  membershipChangeInvoicePreview
}
