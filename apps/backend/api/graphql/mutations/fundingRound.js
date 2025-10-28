/* global FundingRound, Group, GroupMembership, Responsibility, Queue, bookshelf, Post, FundingRoundUser, PostUser */
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

  // Convert role arrays to JSON format for storage
  if (data.submitterRoles) {
    attrs.submitter_roles = JSON.stringify(data.submitterRoles)
  }
  if (data.voterRoles) {
    attrs.voter_roles = JSON.stringify(data.voterRoles)
  }

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

    // Convert role arrays to JSON format for storage
    if (data.submitterRoles) {
      updatedAttrs.submitter_roles = JSON.stringify(data.submitterRoles || [])
    }
    if (data.voterRoles) {
      updatedAttrs.voter_roles = JSON.stringify(data.voterRoles || [])
    }

    await round.save({ updated_at: new Date(), ...updatedAttrs }, { transacting, patch: true })

    await doPhaseTransition(userId, round, { transacting })

    Queue.classMethod('Group', 'doesMenuUpdate', { groupIds: [group.id], fundingRound: round })

    return round
  })
}

export async function deleteFundingRound (userId, id) {
  const round = await FundingRound.where({ id }).fetch()
  if (!round) throw new GraphQLError('FundingRound not found')
  const group = await round.group().fetch()
  const canManage = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_ROUNDS)
  if (!canManage) throw new GraphQLError('You do not have permission to delete funding rounds')
  await round.save({ deactivated_at: new Date() }, { patch: true })
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

// Perform a phase transition for a funding round
export async function doPhaseTransition (userId, roundOrId, { transacting } = {}) {
  if (!transacting) {
    return bookshelf.transaction(async transacting => {
      return await doPhaseTransition(userId, roundOrId, { transacting })
    })
  }

  const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)
  if (!round) throw new GraphQLError('FundingRound not found')

  const now = new Date()
  const currentPhase = round.get('phase')
  const publishedAt = round.get('published_at')
  const submissionsOpenAt = round.get('submissions_open_at')
  const submissionsCloseAt = round.get('submissions_close_at')
  const votingOpensAt = round.get('voting_opens_at')
  const votingClosesAt = round.get('voting_closes_at')

  let newPhase = currentPhase

  // Determine the next phase based on current phase and timestamps
  if (currentPhase === FundingRound.PHASES.DRAFT && publishedAt && new Date(publishedAt) <= now) {
    newPhase = FundingRound.PHASES.PUBLISHED
  } else if (currentPhase === FundingRound.PHASES.PUBLISHED && submissionsOpenAt && new Date(submissionsOpenAt) <= now) {
    newPhase = FundingRound.PHASES.SUBMISSIONS
  } else if (currentPhase === FundingRound.PHASES.SUBMISSIONS && submissionsCloseAt && new Date(submissionsCloseAt) <= now) {
    newPhase = FundingRound.PHASES.DISCUSSION
  } else if ((currentPhase === FundingRound.PHASES.SUBMISSIONS || currentPhase === FundingRound.PHASES.DISCUSSION) && votingOpensAt && new Date(votingOpensAt) <= now) {
    newPhase = FundingRound.PHASES.VOTING
    // Distribute tokens when transitioning to voting
    await FundingRound.distributeTokens(round, { transacting })
  } else if (currentPhase === FundingRound.PHASES.VOTING && votingClosesAt && new Date(votingClosesAt) <= now) {
    newPhase = FundingRound.PHASES.COMPLETED
  // Check if any of the dates were cleared and we need to go back to a previous phase
  } else if (votingClosesAt === null && currentPhase === FundingRound.PHASES.COMPLETED) {
    newPhase = FundingRound.PHASES.VOTING
  } else if (votingOpensAt === null && (currentPhase === FundingRound.PHASES.VOTING || currentPhase === FundingRound.PHASES.COMPLETED)) {
    // If clearing votingOpensAt while in voting or completed phase, reset to discussion or submissions
    await FundingRound.clearTokenDistribution(round, { transacting })
    // Reset phase based on whether submissions are still open
    newPhase = submissionsCloseAt && new Date(submissionsCloseAt) <= new Date()
      ? FundingRound.PHASES.DISCUSSION
      : FundingRound.PHASES.SUBMISSIONS
  } else if (submissionsCloseAt === null && [FundingRound.PHASES.DISCUSSION, FundingRound.PHASES.VOTING, FundingRound.PHASES.COMPLETED].includes(currentPhase)) {
    // If clearing submissionsCloseAt while in discussion or later, reset to submissions
    newPhase = FundingRound.PHASES.SUBMISSIONS
  } else if (submissionsOpenAt === null && [FundingRound.PHASES.SUBMISSIONS, FundingRound.PHASES.DISCUSSION, FundingRound.PHASES.VOTING, FundingRound.PHASES.COMPLETED].includes(currentPhase)) {
    // If clearing submissionsOpenAt while in submissions or later, reset to published
    newPhase = FundingRound.PHASES.PUBLISHED
  } else if (publishedAt === null && currentPhase !== FundingRound.PHASES.DRAFT) {
    // If clearing publishedAt while not in draft, reset to draft
    newPhase = FundingRound.PHASES.DRAFT
  }

  if (newPhase !== currentPhase) {
    // Save the new phase
    await round.save({ phase: newPhase }, { transacting, patch: true })
    if (newPhase !== FundingRound.PHASES.DRAFT && newPhase !== FundingRound.PHASES.PUBLISHED) {
      Queue.classMethod('FundingRound', 'sendPhaseTransitionNotifications', { roundId: round.id, phase: newPhase })
    }
  }

  return round
}

export async function allocateTokensToSubmission (userId, postId, tokens) {
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

  // Check if user has permission to vote
  const canVote = await round.canUserVote(userId)
  if (!canVote) throw new GraphQLError('You do not have the required role to vote in this funding round')

  // Check if tokens have been distributed (voting phase has started)
  const phase = round.get('phase')
  if (phase !== FundingRound.PHASES.VOTING && phase !== FundingRound.PHASES.COMPLETED) {
    throw new GraphQLError('Voting has not started yet')
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
