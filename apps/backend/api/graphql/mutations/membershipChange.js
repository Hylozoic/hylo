/**
 * GraphQL mutation: commit membership subscription change (Stripe Connect).
 */

import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import StripeService from '../../services/StripeService'
import { resolveSubscriptionChangeMode, SUBSCRIPTION_CHANGE_MODE } from '../../../lib/subscriptionChangeRules'
import {
  productGrantsGroupAccess,
  isRecurringSubscriptionOffering,
  isLifetimeOrOneTimeOffering
} from '../../../lib/membershipOfferingEligibility'
import { getSlidingScaleFromOffering } from '../../../lib/stripeOfferingMetadata'
import { computeHyloUnusedPrepaidCreditCents } from '../../../lib/membershipChangeCredit'

/* global ContentAccess, Group, GroupMembership, StripeProduct, StripeAccount, SubscriptionChangeEvent */

/**
 * Resolves DB stripe account id to Stripe external acct_ id.
 *
 * @param {string|number|null} accountId
 */
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

/**
 * Finds active content_access for this user's recurring membership purchase on the offering.
 *
 * @param {string|number} userId
 * @param {string|number} groupId
 * @param {string|number} productId
 */
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

  if (!rows.length) {
    return null
  }

  const subIds = [...new Set(rows.models.map(r => r.get('stripe_subscription_id')).filter(Boolean))]
  if (subIds.length > 1) {
    throw new GraphQLError('Multiple active subscriptions found for this membership; contact support.')
  }

  const first = rows.first()
  return {
    contentAccess: first,
    stripeSubscriptionId: subIds[0],
    stripeCustomerId: first.get('stripe_customer_id') || null
  }
}

/**
 * Applies subscription change in Stripe after preview rules; records subscription_change_events.
 *
 * @param {string|number|null} userId
 * @param {{ groupId: string, fromOfferingId: string, toOfferingId: string, newQuantity?: number }} args
 */
async function membershipChangeCommit (userId, { groupId, fromOfferingId, toOfferingId, newQuantity }) {
  if (!userId) {
    throw new GraphQLError('You must be logged in')
  }

  const hasMembership = await GroupMembership.hasActiveMembership(userId, groupId)
  if (!hasMembership) {
    throw new GraphQLError('You must be a member of this group')
  }

  const fromId = parseInt(fromOfferingId, 10)
  const toId = parseInt(toOfferingId, 10)
  if (isNaN(fromId) || isNaN(toId)) {
    throw new GraphQLError('Invalid offering id')
  }

  const fromProduct = await StripeProduct.where({ id: fromId }).fetch()
  const toProduct = await StripeProduct.where({ id: toId }).fetch()

  if (!fromProduct || !toProduct) {
    throw new GraphQLError('Offering not found')
  }

  if (parseInt(fromProduct.get('group_id'), 10) !== parseInt(groupId, 10) ||
      parseInt(toProduct.get('group_id'), 10) !== parseInt(groupId, 10)) {
    throw new GraphQLError('Offerings must belong to this group')
  }

  if (!productGrantsGroupAccess(toProduct, groupId)) {
    throw new GraphQLError('Target offering is not eligible for membership subscription change')
  }

  const targetIsLifetime = isLifetimeOrOneTimeOffering(toProduct)
  if (!targetIsLifetime && !isRecurringSubscriptionOffering(toProduct, { includeDayDuration: false })) {
    throw new GraphQLError('Target offering is not eligible for membership subscription change')
  }
  const slidingScale = getSlidingScaleFromOffering(toProduct)
  const targetUsesSlidingScale = slidingScale?.enabled === true
  const sameOffering = fromId === toId
  const quantityArg = newQuantity != null ? parseInt(newQuantity, 10) : null
  const isSlidingScaleQuantityOnly = sameOffering &&
    targetUsesSlidingScale &&
    quantityArg != null && !isNaN(quantityArg) && quantityArg >= 1

  if (targetUsesSlidingScale && quantityArg == null) {
    throw new GraphQLError('This plan uses sliding scale. Please choose a quantity before confirming.')
  }

  if (quantityArg != null) {
    if (isNaN(quantityArg) || quantityArg < 1) {
      throw new GraphQLError('Quantity must be a positive whole number')
    }
    if (slidingScale?.minimum != null && quantityArg < slidingScale.minimum) {
      throw new GraphQLError(`Quantity must be at least ${slidingScale.minimum}`)
    }
    if (slidingScale?.maximum != null && quantityArg > slidingScale.maximum) {
      throw new GraphQLError(`Quantity cannot exceed ${slidingScale.maximum}`)
    }
  }

  if (sameOffering && !isSlidingScaleQuantityOnly) {
    throw new GraphQLError('Same offering requires newQuantity when sliding scale is enabled, or pick a different offering')
  }

  if (!sameOffering && !productGrantsGroupAccess(fromProduct, groupId)) {
    throw new GraphQLError('Current offering does not grant access for this group')
  }

  const accessCtx = await findMembershipSubscriptionAccess(userId, groupId, fromId)
  if (!accessCtx) {
    throw new GraphQLError('No active subscription found for this membership offering')
  }

  const group = await Group.find(groupId)
  if (!group || !group.get('stripe_account_id')) {
    throw new GraphQLError('Group does not have a connected Stripe account')
  }
  const externalAccountId = await getExternalAccountId(group.get('stripe_account_id'))

  const subscription = await StripeService.getSubscription(externalAccountId, accessCtx.stripeSubscriptionId)
  const isPastDue = subscription.status === 'past_due'

  const modeResult = resolveSubscriptionChangeMode({
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

  const mode = modeResult.mode
  if (mode === SUBSCRIPTION_CHANGE_MODE.CURRENCY_MISMATCH_BLOCKED) {
    throw new GraphQLError('Cannot switch between plans with different currencies. Choose a plan in the same currency.')
  }
  const correlationId = uuidv4()

  const eventAttrs = {
    user_id: parseInt(userId, 10),
    group_id: parseInt(groupId, 10),
    correlation_id: correlationId,
    from_product_id: fromId,
    to_product_id: toId,
    mode,
    stripe_subscription_id: accessCtx.stripeSubscriptionId,
    stripe_customer_id: accessCtx.stripeCustomerId || (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id),
    status: 'pending',
    payload: {
      modeReason: modeResult.reason || null,
      meta: modeResult.meta || null,
      targetStripePriceId: toProduct.get('stripe_price_id') || null,
      targetQuantity: quantityArg
    }
  }

  const changeEvent = await SubscriptionChangeEvent.forge(eventAttrs).save()

  try {
    const meta = { hylo_correlation_id: correlationId }

    if (mode === SUBSCRIPTION_CHANGE_MODE.SLIDING_SCALE_NEXT_CYCLE) {
      await StripeService.updateSubscriptionPrimaryItemQuantity({
        accountId: externalAccountId,
        subscriptionId: accessCtx.stripeSubscriptionId,
        quantity: quantityArg,
        prorationBehavior: 'none',
        metadata: meta
      })
    } else if (mode === SUBSCRIPTION_CHANGE_MODE.IMMEDIATE_UPGRADE ||
      mode === SUBSCRIPTION_CHANGE_MODE.PAST_DUE_NO_PRORATION) {
      const newPriceId = toProduct.get('stripe_price_id')
      if (!newPriceId) {
        throw new Error('Target offering has no Stripe price id')
      }
      const customerId = accessCtx.stripeCustomerId ||
        (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id)
      if (!customerId) {
        throw new Error('Stripe customer not found')
      }
      const periodPriceCents = await StripeService.resolvePrimaryItemPeriodPriceCents({
        accountId: externalAccountId,
        subscription,
        fromProduct
      })
      const creditCents = computeHyloUnusedPrepaidCreditCents(subscription, fromProduct, undefined, periodPriceCents)
      const cur = (fromProduct.get('currency') || 'usd').toLowerCase()

      if (creditCents > 0) {
        await StripeService.createCustomerBalanceCredit({
          accountId: externalAccountId,
          customerId,
          amountCents: creditCents,
          currency: cur,
          description: `Hylo membership change — unused prepaid time (${correlationId})`
        })
      }

      await StripeService.updateSubscriptionPrimaryItemPrice({
        accountId: externalAccountId,
        subscriptionId: accessCtx.stripeSubscriptionId,
        newPriceId,
        quantity: targetUsesSlidingScale ? quantityArg : null,
        prorationBehavior: 'none',
        billingCycleAnchor: 'now',
        metadata: {
          ...meta,
          hylo_swap_credit_cents: String(creditCents),
          hylo_swap_anchor: 'now'
        }
      })
      Object.assign(eventAttrs.payload, { hyloPrepaidCreditCents: creditCents })
    } else if (mode === SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END) {
      const newPriceId = toProduct.get('stripe_price_id')
      if (!newPriceId) {
        throw new Error('Target offering has no Stripe price id')
      }
      await StripeService.scheduleSubscriptionPrimaryItemPriceAtPeriodEnd({
        accountId: externalAccountId,
        subscriptionId: accessCtx.stripeSubscriptionId,
        newPriceId,
        quantity: targetUsesSlidingScale ? quantityArg : null,
        metadata: meta
      })

      const periodEndUnix = subscription.current_period_end ?? subscription.currentPeriodEnd
      const pendingEffectiveAt = periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null
      await changeEvent.save({
        status: 'pending',
        pending_effective_at: pendingEffectiveAt,
        payload: {
          ...eventAttrs.payload,
          scheduled: true
        }
      })

      return {
        success: true,
        message: 'Subscription change scheduled for period end',
        mode,
        subscriptionChangeEventId: String(changeEvent.id)
      }
    } else if (mode === SUBSCRIPTION_CHANGE_MODE.LIFETIME_NO_PRORATION) {
      await StripeService.cancelSubscription({
        accountId: externalAccountId,
        subscriptionId: accessCtx.stripeSubscriptionId,
        immediately: false
      })

      const periodEndUnix = subscription.current_period_end ?? subscription.currentPeriodEnd
      const pendingEffectiveAt = periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null
      await changeEvent.save({
        status: 'pending',
        pending_effective_at: pendingEffectiveAt,
        payload: {
          ...eventAttrs.payload,
          scheduledCancellationAtPeriodEnd: true,
          requiresLifetimeCheckout: true
        }
      })

      return {
        success: true,
        message: 'Current subscription will end at period boundary. Complete checkout for the lifetime offering separately.',
        mode,
        subscriptionChangeEventId: String(changeEvent.id)
      }
    } else {
      throw new Error(`Unhandled subscription change mode: ${mode}`)
    }

    await changeEvent.save({
      status: 'applied',
      applied_at: new Date(),
      payload: {
        ...eventAttrs.payload,
        applied: true
      }
    })

    return {
      success: true,
      message: 'Subscription updated',
      mode,
      subscriptionChangeEventId: String(changeEvent.id)
    }
  } catch (err) {
    const message = err.message || String(err)
    await changeEvent.save({
      status: 'failed',
      error_message: message
    })
    throw new GraphQLError(message)
  }
}

export {
  membershipChangeCommit
}
