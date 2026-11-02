/**
 * Hylo Pro GraphQL mutations: a group paying Hylo for Pro, on the platform Stripe account.
 * Only members with the Administration responsibility can manage a group's billing.
 */

import { GraphQLError } from 'graphql'
import HyloProService from '../../services/HyloProService'

/* global Group, GroupMembership, HyloProSubscription, Responsibility */

// Stripe keeps retrying payment on these, so the subscription still exists
const UNPAID_STATUSES = ['past_due', 'unpaid']

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

  // A subscription that is active, or still open with a failed payment, is changed in the portal instead
  const rows = (await HyloProSubscription.forGroup(group.id)).models
  const hasOpenSubscription = rows.some(row => row.get('source') === HyloProSubscription.SOURCE_STRIPE &&
    (row.isActive() || UNPAID_STATUSES.includes(row.get('status'))))
  if (hasOpenSubscription) {
    throw new GraphQLError('This group already has a Hylo Pro subscription. Use Manage subscription to change it.')
  }

  const { url } = await HyloProService.createCheckoutSession({ group, interval, userId })
  return { url }
}

export async function createHyloProPortalSession (userId, { groupId }) {
  const group = await findGroupForBilling(userId, groupId)

  const session = await HyloProService.createPortalSession({ group })
  if (!session) throw new GraphQLError('This group has no Hylo Pro subscription to manage')
  return { url: session.url }
}
