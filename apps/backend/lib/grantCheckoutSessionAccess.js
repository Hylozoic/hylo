/**
 * Grants group/space membership and content_access from a completed Stripe Checkout session.
 * Used by the checkout.session.completed webhook and by fulfillStripeCheckoutSession
 * (success-page fallback when the webhook is delayed or missing).
 */

const { parseJsonObject: parseAccessGrants } = require('./stripeOfferingMetadata')

/* global StripeProduct, GroupMembership, ContentAccess */

/**
 * Group/space ids this offering should join the buyer into.
 * Always includes the selling group, plus access_grants.groupIds (paid spaces).
 *
 * @param {import('bookshelf').Model} offering
 * @returns {Set<number>}
 */
function groupIdsToJoinFromOffering (offering) {
  const accessGrants = parseAccessGrants(offering.get('access_grants'))
  const grantedByGroupIdNum = parseInt(offering.get('group_id'), 10)
  const ids = new Set()
  if (!isNaN(grantedByGroupIdNum) && grantedByGroupIdNum > 0) {
    ids.add(grantedByGroupIdNum)
  }
  for (const groupId of accessGrants.groupIds || []) {
    const groupIdNum = parseInt(groupId, 10)
    if (!isNaN(groupIdNum) && groupIdNum > 0) ids.add(groupIdNum)
  }
  return ids
}

/**
 * @param {object} session - Stripe Checkout Session
 * @returns {Promise<{
 *   granted: boolean,
 *   already?: boolean,
 *   reason?: string,
 *   userId?: string,
 *   groupId?: string,
 *   offering?: import('bookshelf').Model,
 *   accessRecords?: object[],
 *   stripeSubscriptionId?: string|null
 * }>}
 */
async function grantCheckoutSessionAccess (session) {
  const userId = session.metadata?.userId
  const groupId = session.metadata?.groupId
  const offeringId = session.metadata?.offeringId

  if (!userId || !groupId || !offeringId) {
    return { granted: false, reason: 'missing_metadata' }
  }

  const offering = await StripeProduct.where({ id: offeringId }).fetch()
  if (!offering) {
    return { granted: false, reason: 'offering_not_found' }
  }

  const offeringGroupId = offering.get('group_id')
  if (parseInt(offeringGroupId, 10) !== parseInt(groupId, 10)) {
    return { granted: false, reason: 'group_mismatch' }
  }

  const userIdNum = parseInt(userId, 10)
  const stripeSubscriptionId = session.subscription || null

  for (const accessGroupId of groupIdsToJoinFromOffering(offering)) {
    try {
      const membership = await GroupMembership.ensureMembership(userIdNum, accessGroupId)
      if (membership) {
        await membership.acceptAgreements()
      }
      await GroupMembership.pinGroupToNav(userIdNum, accessGroupId)
    } catch (error) {
      console.error(`Error ensuring membership for user ${userIdNum} in group ${accessGroupId}:`, error)
    }
  }

  const existing = await ContentAccess.forStripeSession(session.id)
  if (existing?.models?.length > 0) {
    return {
      granted: true,
      already: true,
      userId,
      groupId,
      offering,
      accessRecords: existing.models,
      stripeSubscriptionId
    }
  }

  const accessRecords = await offering.generateContentAccessRecords({
    userId: userIdNum,
    sessionId: session.id,
    stripeSubscriptionId,
    stripeCustomerId: session.customer || null,
    metadata: {
      paymentAmount: session.amount_total,
      currency: session.currency,
      purchasedAt: new Date().toISOString()
    }
  })

  return {
    granted: true,
    userId,
    groupId,
    offering,
    accessRecords,
    stripeSubscriptionId
  }
}

module.exports = {
  grantCheckoutSessionAccess,
  groupIdsToJoinFromOffering
}
