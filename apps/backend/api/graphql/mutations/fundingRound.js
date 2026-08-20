/* global FundingRound, Group, GroupMembership, Responsibility, Queue, bookshelf, Post, PostUser */
import { omit } from 'lodash'
import { GraphQLError } from 'graphql'
import convertGraphqlData from './convertGraphqlData'

/** Parses a funding-round date input into a valid Date, or null. */
function parseFundingRoundDate (value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  // Millisecond timestamps (number or numeric string) — GraphQL Date scalar cannot parse these as strings
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const date = new Date(Number(value))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// XXX: convertGraphqlData turns Date objects into {} — re-parse from original input
const fixDateFields = (attrs, data) => {
  const dateFields = [
    { from: 'publishedAt', to: 'published_at' },
    { from: 'votingOpensAt', to: 'voting_opens_at' },
    { from: 'votingClosesAt', to: 'voting_closes_at' },
    { from: 'submissionsOpenAt', to: 'submissions_open_at' },
    { from: 'submissionsCloseAt', to: 'submissions_close_at' }
  ]
  dateFields.forEach(({ from, to }) => {
    if (!(from in data)) return
    attrs[to] = parseFundingRoundDate(data[from])
  })
  return attrs
}

/**
 * True if user can manage funding rounds for this group/space.
 * Spaces inherit Administration from the parent (stewards editing from the parent menu
 * may not have a membership on the space itself).
 */
async function canManageFundingRounds (userId, group, { transacting } = {}) {
  if (!group) return false
  if (await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION, { transacting })) {
    return true
  }
  const parentId = group.get('parent_id')
  if (!parentId) return false
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
  return responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)
}

export async function createFundingRound (userId, data) {
  const attrs = convertGraphqlData(omit(data, 'title', 'bannerUrl', 'description'))
  // Required fields
  if (!attrs.group_id) throw new GraphQLError('groupId is required')
  if (!attrs.voting_method) throw new GraphQLError('votingMethod is required')
  if (!attrs.total_tokens) throw new GraphQLError('totalTokens is required')

  const group = await Group.find(attrs.group_id)
  if (!group) throw new GraphQLError('Invalid group')

  if (!(await canManageFundingRounds(userId, group))) {
    throw new GraphQLError('You do not have permission to create funding rounds')
  }
  // Convert role arrays to JSON format for storage
  if (data.submitterRoles) {
    attrs.submitter_roles = JSON.stringify(data.submitterRoles)
  }
  if (data.voterRoles) {
    attrs.voter_roles = JSON.stringify(data.voterRoles)
  }

  const round = await FundingRound.create(fixDateFields(attrs, data), userId)

  // If this round is for a Space that isn't already backed by a round, link it (spec section
  // "Track/Funding Round space creation") so the space recognizes it as a Funding Round space.
  if (group.get('type') === 'space' && !group.get('funding_round_id')) {
    await group.save({ funding_round_id: round.id }, { patch: true })
  }

  return round
}

export async function updateFundingRound (userId, id, data) {
  return bookshelf.transaction(async transacting => {
    const round = await FundingRound.where({ id }).fetch({ transacting })
    if (!round) throw new GraphQLError('FundingRound not found')

    const group = await round.group().fetch({ transacting })
    if (!(await canManageFundingRounds(userId, group, { transacting }))) {
      throw new GraphQLError('You do not have permission to update funding rounds')
    }

    const attrs = convertGraphqlData(omit(data, 'title', 'bannerUrl', 'description'))
    const updatedAttrs = fixDateFields(attrs, data)

    // Convert role arrays to JSON format for storage
    if (data.submitterRoles) {
      updatedAttrs.submitter_roles = JSON.stringify(data.submitterRoles || [])
    }
    if (data.voterRoles) {
      updatedAttrs.voter_roles = JSON.stringify(data.voterRoles || [])
    }

    // Check if allow_self_voting is being changed from true to false during voting phase
    const currentAllowSelfVoting = round.get('allow_self_voting')
    const newAllowSelfVoting = updatedAttrs.allow_self_voting !== undefined ? updatedAttrs.allow_self_voting : currentAllowSelfVoting
    const phase = round.get('phase')
    const isVotingPhase = phase === FundingRound.PHASES.VOTING || phase === FundingRound.PHASES.COMPLETED

    if (currentAllowSelfVoting === true && newAllowSelfVoting === false && isVotingPhase) {
      const spaceId = round.get('group_id')
      const selfVotes = await bookshelf.knex('groups_posts')
        .join('posts', 'posts.id', 'groups_posts.post_id')
        .join('posts_users', 'posts_users.post_id', 'groups_posts.post_id')
        .where('groups_posts.group_id', spaceId)
        .where('posts.type', Post.Type.SUBMISSION)
        .where('posts_users.tokens_allocated_to', '>', 0)
        .where('posts_users.active', true)
        .whereRaw('posts_users.user_id = posts.user_id')
        .select(
          'posts_users.user_id',
          'posts_users.post_id',
          'posts_users.tokens_allocated_to'
        )

      // Return tokens to users via space membership settings
      for (const selfVote of selfVotes) {
        const voterId = selfVote.user_id
        const tokensToReturn = selfVote.tokens_allocated_to || 0

        if (tokensToReturn > 0) {
          const membership = await GroupMembership.forPair(voterId, spaceId).fetch({ transacting })
          if (membership) {
            const currentRemaining = membership.get('settings')?.tokensRemaining || 0
            membership.addSetting({ tokensRemaining: currentRemaining + tokensToReturn })
            await membership.save({ settings: membership.get('settings') }, { transacting, patch: true })
          }

          // Clear the allocation
          await bookshelf.knex('posts_users')
            .where({
              post_id: selfVote.post_id,
              user_id: voterId
            })
            .update({ tokens_allocated_to: 0 })
            .transacting(transacting)
        }
      }
    }

    await round.save({ updated_at: new Date(), ...updatedAttrs }, { transacting, patch: true })

    await doPhaseTransition(userId, round, { transacting })

    return round
  })
}

export async function deleteFundingRound (userId, id) {
  const round = await FundingRound.where({ id }).fetch()
  if (!round) throw new GraphQLError('FundingRound not found')
  const group = await round.group().fetch()
  if (!(await canManageFundingRounds(userId, group))) {
    throw new GraphQLError('You do not have permission to delete funding rounds')
  }
  await round.save({ deactivated_at: new Date() }, { patch: true })
  return { success: true }
}

export async function joinFundingRound (userId, roundId) {
  const round = await FundingRound.find(roundId)
  if (!round) throw new GraphQLError('FundingRound not found')
  const space = await round.group().fetch()
  if (!space) throw new GraphQLError('Funding round space not found')

  // Must be a member of the parent community (or the group itself if not a space)
  const parentId = space.get('parent_id') || space.id
  const isMember = await GroupMembership.forPair(userId, parentId).fetch()
  if (!isMember) throw new GraphQLError('You are not a member of this group')

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
    return bookshelf.transaction(async trx => {
      return await doPhaseTransition(userId, roundOrId, { transacting: trx })
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

  // Find the funding round via the space this submission belongs to
  const roundRow = await bookshelf.knex('funding_rounds')
    .join('groups_posts', 'groups_posts.group_id', 'funding_rounds.group_id')
    .where('groups_posts.post_id', postId)
    .whereNull('funding_rounds.deactivated_at')
    .select('funding_rounds.id')
    .first()

  if (!roundRow) throw new GraphQLError('Post is not part of a funding round')

  const fundingRound = await FundingRound.find(roundRow.id)
  if (!fundingRound) throw new GraphQLError('Funding round not found')

  // Check if user is participating in the round
  const isParticipating = await fundingRound.isParticipating(userId)
  if (!isParticipating) throw new GraphQLError('You must be participating in this round to allocate tokens')

  // Check if user has permission to vote
  const canVote = await fundingRound.canUserVote(userId)
  if (!canVote) throw new GraphQLError('You do not have the required role to vote in this funding round')

  // Check if self-voting is allowed
  const allowSelfVoting = fundingRound.get('allow_self_voting')
  const postCreatorId = post.get('user_id')
  if (!allowSelfVoting && parseInt(postCreatorId) === parseInt(userId)) {
    throw new GraphQLError('You cannot vote on your own submission')
  }

  // Check if tokens have been distributed (voting phase has started)
  const phase = fundingRound.get('phase')
  if (phase !== FundingRound.PHASES.VOTING && phase !== FundingRound.PHASES.COMPLETED) {
    throw new GraphQLError('Voting has not started yet')
  }

  // Get user's current token balance from space membership
  const membership = await GroupMembership.forPair(userId, fundingRound.get('group_id')).fetch()
  if (!membership) throw new GraphQLError('User not found in funding round')

  // Get current allocation to this post
  const postUser = await PostUser.find(postId, userId)
  const currentAllocation = postUser ? postUser.get('tokens_allocated_to') || 0 : 0

  // Calculate the difference
  const tokenDifference = tokens - currentAllocation

  // Check if user has enough tokens
  const tokensRemaining = membership.get('settings')?.tokensRemaining || 0
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

  // Update user's remaining tokens on membership settings
  membership.addSetting({ tokensRemaining: tokensRemaining - tokenDifference })
  await membership.save({ settings: membership.get('settings') }, { patch: true })

  return post
}
