/**
 * Hylo Pro GraphQL mutations: a group paying Hylo for Pro, on the platform Stripe account.
 * Only members with the Administration responsibility can manage a group's billing.
 */

import { GraphQLError } from 'graphql'
import HyloProService from '../../services/HyloProService'

/* global Group, GroupMembership, HyloProSubscription, Responsibility */

async function findGroupForBilling (userId, groupId) {
  if (!userId) throw new GraphQLError('You must be logged in to manage billing')

  const group = await Group.find(groupId)
  if (!group || !group.get('active')) throw new GraphQLError('Group not found')
  if (group.get('type') === 'space') throw new GraphQLError('Hylo Pro is only available for groups, not spaces')

  const canAdminister = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION)
  if (!canAdminister) throw new GraphQLError("You don't have permission to manage this group's billing")

  return group
}

export async function createHyloProCheckoutSession (userId, { groupId, interval }) {
  const group = await findGroupForBilling(userId, groupId)
  if (!HyloProService.INTERVALS.includes(interval)) {
    throw new GraphQLError(`interval must be one of: ${HyloProService.INTERVALS.join(', ')}`)
  }

  // A subscription that isn't over yet (active, unpaid or paused) is changed in the portal instead.
  // This is a quick check of our table; createCheckoutSession also checks Stripe itself.
  const rows = (await HyloProSubscription.forGroup(group.id)).models
  if (rows.some(row => HyloProSubscription.isOpenStripeSubscription(row))) {
    throw HyloProService.alreadySubscribedError()
  }

  const { url } = await HyloProService.createCheckoutSession({ group, interval, userId })
  return { url }
}

// Called by the Billing page on return from Checkout (success_url carries the session id)
export async function activateHyloProCheckoutSession (userId, { groupId, sessionId }) {
  const group = await findGroupForBilling(userId, groupId)
  if (!sessionId) throw new GraphQLError('sessionId is required')

  const row = await HyloProService.activateCheckoutSession({ group, sessionId })
  return { success: true, active: !!row && row.isActive() }
}

export async function createHyloProPortalSession (userId, { groupId }) {
  const group = await findGroupForBilling(userId, groupId)

  const session = await HyloProService.createPortalSession({ group })
  if (!session) throw new GraphQLError('This group has no Hylo Pro subscription to manage')
  return { url: session.url }
}
