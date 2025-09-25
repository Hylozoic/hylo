/* global FundingRound, Group, GroupMembership, Responsibility */
import { } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

export async function createFundingRound (userId, data) {
  const attrs = convertGraphqlData(data)
  // Required fields
  if (!attrs.title) throw new GraphQLError('title is required')
  if (!attrs.group_id) throw new GraphQLError('groupId is required')

  const group = await Group.find(attrs.group_id)
  if (!group) throw new GraphQLError('Invalid group')

  const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS)
  if (!canManage) throw new GraphQLError('You do not have permission to create funding rounds')

  const dateFields = [
    { from: 'publishedAt', to: 'published_at' },
    { from: 'votingOpensAt', to: 'voting_opens_at' },
    { from: 'votingClosesAt', to: 'voting_closes_at' },
    { from: 'submissionsOpenAt', to: 'submissions_open_at' },
    { from: 'submissionsCloseAt', to: 'submissions_close_at' }
  ]

  dateFields.forEach(({ from, to }) => {
    if (data[from]) {
      attrs[to] = new Date(Number(data[from])) // XXX: because convertGraphqlData messes up dates
    }
  })

  const round = await FundingRound.create(attrs)
  return round
}

export async function updateFundingRound (userId, id, data) {
  const round = await FundingRound.where({ id }).fetch()
  if (!round) throw new GraphQLError('FundingRound not found')
  const group = await round.group().fetch()
  const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS)
  if (!canManage) throw new GraphQLError('You do not have permission to update funding rounds')
  const attrs = convertGraphqlData(data)
  await round.save({ updated_at: new Date(), ...attrs })
  return round
}

export async function deleteFundingRound (userId, id) {
  const round = await FundingRound.where({ id }).fetch()
  if (!round) throw new GraphQLError('FundingRound not found')
  const group = await round.group().fetch()
  const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS)
  if (!canManage) throw new GraphQLError('You do not have permission to delete funding rounds')
  await round.destroy()
  return { success: true }
}
