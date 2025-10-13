/* global FundingRound, Group, GroupMembership, Responsibility */
import { } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

// XXX: because convertGraphqlData messes up dates
const fixDateFields = (attrs, data) => {
  const dateFields = [
    { from: 'publishedAt', to: 'published_at' },
    { from: 'votingOpensAt', to: 'voting_opens_at' },
    { from: 'votingClosesAt', to: 'voting_closes_at' },
    { from: 'submissionsOpenAt', to: 'submissions_open_at' },
    { from: 'submissionsCloseAt', to: 'submissions_close_at' }
  ]
  dateFields.forEach(({ from, to }) => {
    if (data[from]) {
      attrs[to] = new Date(Number(data[from]))
    }
  })
  return attrs
}

export async function createFundingRound (userId, data) {
  const attrs = convertGraphqlData(data)
  // Required fields
  if (!attrs.title) throw new GraphQLError('title is required')
  if (!attrs.group_id) throw new GraphQLError('groupId is required')

  const group = await Group.find(attrs.group_id)
  if (!group) throw new GraphQLError('Invalid group')

  const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS)
  if (!canManage) throw new GraphQLError('You do not have permission to create funding rounds')

  const round = await FundingRound.create(fixDateFields(attrs, data))
  Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: data.groupIds, fundingRound: round })
  return round
}

export async function updateFundingRound (userId, id, data) {
  return bookshelf.transaction(async transacting => {
    const round = await FundingRound.where({ id }).fetch({ transacting })
    if (!round) throw new GraphQLError('FundingRound not found')

    const group = await round.group().fetch()
    const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS, { transacting })
    if (!canManage) throw new GraphQLError('You do not have permission to update funding rounds')

    const attrs = convertGraphqlData(data)
    const updatedAttrs = fixDateFields(attrs, data)
    await round.save({ updated_at: new Date(), ...updatedAttrs }, { transacting })

    // If going back from voting phase (clearing votingOpensAt), clear token distribution
    if (data.votingOpensAt === null && round.get('tokens_distributed_at')) {
      await FundingRound.clearTokenDistribution(round, { transacting })
    }

    if (data.votingOpensAt !== null && !round.get('tokens_distributed_at')) {
      await FundingRound.distributeTokens(round, { transacting })
    }
    return round
  })
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

export async function joinFundingRound (userId, roundId) {
  // TODO: check if the user can see the round?
  await FundingRound.join(roundId, userId)
  return FundingRound.find(roundId)
}

export async function leaveFundingRound (userId, roundId) {
  await FundingRound.leave(roundId, userId)
  return FundingRound.find(roundId)
}

export async function distributeFundingRoundTokens (userId, roundId) {
  const round = await FundingRound.find(roundId)
  if (!round) throw new GraphQLError('FundingRound not found')

  // Check if user is participating in the round
  const isParticipating = await round.isParticipating(userId)
  if (!isParticipating) throw new GraphQLError('You must be participating in this round')

  await FundingRound.distributeTokens(roundId)
  return FundingRound.find(roundId)
}

export async function allocateTokensToSubmission (userId, postId, tokens) {
  console.log('allocateTokensToSubmission', userId, postId, tokens)
  if (!postId) throw new GraphQLError('postId is required')
  if (tokens === undefined || tokens === null) throw new GraphQLError('tokens is required')
  if (tokens < 0) throw new GraphQLError('tokens must be non-negative')

  const post = await Post.where({ id: postId }).fetch()
  if (!post) throw new GraphQLError('Post not found')
  if (post.get('type') !== Post.Type.SUBMISSION) throw new GraphQLError('Post must be a submission')

  // Find the funding round this submission belongs to
  const fundingRoundPost = await bookshelf.knex('funding_rounds_posts')
    .where({ post_id: postId })
    .first()

  if (!fundingRoundPost) throw new GraphQLError('Post is not part of a funding round')

  const round = await FundingRound.find(fundingRoundPost.funding_round_id)
  if (!round) throw new GraphQLError('Funding round not found')

  // Check if user is participating in the round
  const isParticipating = await round.isParticipating(userId)
  if (!isParticipating) throw new GraphQLError('You must be participating in this round to allocate tokens')

  // Check if tokens have been distributed
  if (!round.get('tokens_distributed_at')) {
    throw new GraphQLError('Tokens have not been distributed yet')
  }

  // Get user's current token balance
  const roundUser = await FundingRoundUser.where({
    funding_round_id: fundingRoundPost.funding_round_id,
    user_id: userId
  }).fetch()

  if (!roundUser) throw new GraphQLError('User not found in funding round')

  // Get current allocation to this post
  const postUser = await PostUser.find(postId, userId)
  const currentAllocation = postUser ? postUser.get('tokens_allocated_to') || 0 : 0

  // Calculate the difference
  const tokenDifference = tokens - currentAllocation

  // Check if user has enough tokens
  const tokensRemaining = roundUser.get('tokens_remaining') || 0
  if (tokenDifference > tokensRemaining) {
    throw new GraphQLError(`Not enough tokens remaining. You have ${tokensRemaining} tokens remaining.`)
  }

  // Update or create PostUser record
  if (postUser) {
    await postUser.updateAndSave({ tokens_allocated_to: tokens })
  } else {
    await PostUser.forge({
      post_id: postId,
      user_id: userId,
      tokens_allocated_to: tokens,
      following: false,
      active: true
    }).save()
  }

  // Update user's remaining tokens
  await roundUser.save({ tokens_remaining: tokensRemaining - tokenDifference })

  return post
}
