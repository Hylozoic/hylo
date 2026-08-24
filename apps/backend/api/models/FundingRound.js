/* eslint-disable camelcase */
/* global bookshelf, Group, GroupMembership, Post, GroupRole, User, MemberGroupRole, FundingRound, Tag, RichText, Queue */
import { GraphQLError } from 'graphql'
import { sendPhaseTransitionNotifications, sendReminderNotifications, notifyStewardsOfSubmission } from './FundingRound/notifications'

/** Active space membership for a funding-round participant (join space = participate). */
function participationMembership (round, userId, { transacting, includeInactive } = {}) {
  const groupId = round.get('group_id')
  if (!groupId || !userId) return Promise.resolve(null)
  return GroupMembership.forPair(userId, groupId, { includeInactive }).fetch({ transacting })
}

/** Tokens remaining for a participant, stored on membership settings. */
function tokensRemainingFromMembership (membership) {
  if (!membership || !membership.get('active')) return null
  const value = membership.getSetting?.('tokensRemaining') ?? membership.get('settings')?.tokensRemaining
  return value === undefined || value === null ? null : value
}

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds',
  requireFetch: false,
  hasTimestamps: true,

  criteria () {
    return RichText.processHTML(this.get('criteria'))
  },

  /** Display name lives on the Funding Round space group. */
  async displayName ({ transacting } = {}) {
    if (this.relations.group) return this.relations.group.get('name') || ''
    const space = await this.group().fetch({ transacting })
    return space ? space.get('name') : ''
  },

  // Serialize JSON columns before saving to database
  format: function (attrs) {
    const formatted = Object.assign({}, attrs)
    // Ensure role fields are properly JSON stringified if they're arrays
    if (formatted.submitter_roles && Array.isArray(formatted.submitter_roles)) {
      formatted.submitter_roles = JSON.stringify(formatted.submitter_roles)
    }
    if (formatted.voter_roles && Array.isArray(formatted.voter_roles)) {
      formatted.voter_roles = JSON.stringify(formatted.voter_roles)
    }
    return formatted
  },

  /** The Funding Round's space Group via funding_rounds.group_id (1:1). */
  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  /**
   * Submission posts on the funding-round space (groups_posts).
   * Marks alreadyJoinedGroupPosts so GraphQL postFilter does not join groups_posts again.
   */
  submissions: function () {
    const spaceId = this.get('group_id')
    return Post.collection().query(q => {
      q.queryContext({ alreadyJoinedGroupPosts: true })
      q.join('groups_posts', 'groups_posts.post_id', 'posts.id')
      q.where('groups_posts.group_id', spaceId)
      q.where('posts.type', Post.Type.SUBMISSION)
      q.orderBy('posts.id', 'asc')
    })
  },

  submitterRoles: async function () {
    const rolesData = this.get('submitter_roles')
    if (!rolesData || rolesData.length === 0) return []

    const roles = await Promise.all(rolesData.map(async roleInfo => {
      return await GroupRole.where({ id: roleInfo.id }).fetch()
    }))

    return roles.filter(r => r) // Filter out any nulls
  },

  /** Participants = active members of the funding-round space. */
  users: function () {
    return this.belongsToMany(User, 'group_memberships', 'group_id', 'user_id', 'group_id')
      .query(q => {
        q.where('group_memberships.active', true)
      })
      .withPivot(['settings', 'created_at'])
  },

  joinedAt: async function (userId) {
    const membership = await participationMembership(this, userId)
    return membership && membership.get('active') ? membership.get('created_at') : null
  },

  isParticipating: async function (userId) {
    const membership = await participationMembership(this, userId)
    return !!(membership && membership.get('active'))
  },

  userSettings: async function (userId) {
    const membership = await participationMembership(this, userId)
    return membership && membership.get('active') ? membership.get('settings') : null
  },

  tokensRemaining: async function (userId) {
    const membership = await participationMembership(this, userId)
    return tokensRemainingFromMembership(membership)
  },

  allocations: async function () {
    const spaceId = this.get('group_id')
    if (!spaceId) return []

    const rows = await bookshelf.knex('groups_posts')
      .join('posts', 'posts.id', 'groups_posts.post_id')
      .join('posts_users', 'posts_users.post_id', 'groups_posts.post_id')
      .where('groups_posts.group_id', spaceId)
      .where('posts.type', Post.Type.SUBMISSION)
      .where('posts.active', true)
      .whereNotNull('posts_users.tokens_allocated_to')
      .where('posts_users.tokens_allocated_to', '>', 0)
      .where('posts_users.active', true)
      .select('posts_users.user_id', 'posts_users.post_id', 'posts_users.tokens_allocated_to')

    if (!rows.length) return []

    const normalizeId = value => String(value)
    const userIds = [...new Set(rows.map(r => normalizeId(r.user_id)).filter(Boolean))]
    const postIds = [...new Set(rows.map(r => normalizeId(r.post_id)).filter(Boolean))]

    const [users, posts] = await Promise.all([
      userIds.length ? User.query(q => q.whereIn('id', userIds)).fetchAll() : Promise.resolve(User.collection()),
      postIds.length ? Post.query(q => q.whereIn('id', postIds)).fetchAll() : Promise.resolve(Post.collection())
    ])

    const userMap = new Map(users.models.map(u => [normalizeId(u.id), u]))
    const postMap = new Map(posts.models.map(p => [normalizeId(p.id), p]))

    return rows.map(row => ({
      user: userMap.get(normalizeId(row.user_id)) || null,
      submission: postMap.get(normalizeId(row.post_id)) || null,
      tokensAllocated: row.tokens_allocated_to || 0
    }))
  },

  voterRoles: async function () {
    const rolesData = this.get('voter_roles')
    if (!rolesData || rolesData.length === 0) return []

    const roles = await Promise.all(rolesData.map(async roleInfo => {
      return await GroupRole.where({ id: roleInfo.id }).fetch()
    }))

    return roles.filter(r => r) // Filter out any nulls
  },

  // Check if a user has any of the required submitter roles (roles live on the parent group for spaces)
  canUserSubmit: async function (userId) {
    const rolesData = this.get('submitter_roles')
    // If no roles are specified, anyone can submit
    if (!rolesData || rolesData.length === 0) return true

    const group = await this.group().fetch()
    if (!group) return false
    const roleScopeId = await Group.roleScopeId(group)

    // Check if user has any of the specified roles
    for (const roleInfo of rolesData) {
      const hasRole = await MemberGroupRole.where({
        user_id: userId,
        group_id: roleScopeId,
        group_role_id: roleInfo.id
      }).fetch()
      if (hasRole) return true
    }

    return false
  },

  // Check if a user has any of the required voter roles (roles live on the parent group for spaces)
  canUserVote: async function (userId) {
    const rolesData = this.get('voter_roles')
    // If no roles are specified, anyone can vote
    if (!rolesData || rolesData.length === 0) return true

    const group = await this.group().fetch()
    if (!group) return false
    const roleScopeId = await Group.roleScopeId(group)

    // Check if user has any of the specified roles
    for (const roleInfo of rolesData) {
      const hasRole = await MemberGroupRole.where({
        user_id: userId,
        group_id: roleScopeId,
        group_role_id: roleInfo.id
      }).fetch()
      if (hasRole) return true
    }

    return false
  }
}, {

  PHASES: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    SUBMISSIONS: 'submissions',
    DISCUSSION: 'discussion',
    VOTING: 'voting',
    COMPLETED: 'completed'
  },

  /**
   * Ensure a submission post is on the funding-round space and bump num_submissions.
   */
  addPost: async function (postOrId, fundingRoundOrId, userId, { transacting } = {}) {
    const postId = typeof postOrId === 'number' || typeof postOrId === 'string' ? postOrId : postOrId.get('id')
    const fundingRound = await (typeof fundingRoundOrId === 'object' ? fundingRoundOrId : FundingRound.find(fundingRoundOrId))
    if (!fundingRound) {
      throw new GraphQLError('Funding Round not found')
    }

    // Check if user has permission to submit
    if (userId) {
      const canSubmit = await fundingRound.canUserSubmit(userId)
      if (!canSubmit) {
        throw new GraphQLError('You do not have the required role to submit to this funding round')
      }
    }

    const spaceId = fundingRound.get('group_id')
    if (!spaceId) {
      throw new GraphQLError('Funding round space not found')
    }

    const existing = await bookshelf.knex('groups_posts')
      .where({ group_id: spaceId, post_id: postId })
      .transacting(transacting)
      .first()

    if (!existing) {
      const post = typeof postOrId === 'object' ? postOrId : await Post.find(postId, { transacting })
      if (!post) throw new GraphQLError('Post not found')
      await post.groups().attach(spaceId, { transacting })
    }

    await fundingRound.save({ num_submissions: fundingRound.get('num_submissions') + 1 }, { transacting })
    return fundingRound
  },

  // Check for phase transitions and perform them, sending notifications
  checkPhaseTransitions: async function () {
    const now = new Date()
    let transitionCount = 0

    return bookshelf.transaction(async transacting => {
      // Transition from draft to published
      const publishingRounds = await FundingRound.query(q => {
        q.where('deactivated_at', null)
        q.whereNotNull('published_at')
        q.where('phase', FundingRound.PHASES.DRAFT)
        q.where('published_at', '<=', now)
      }).fetchAll({ transacting })

      for (const round of publishingRounds.models) {
        await round.save({ phase: FundingRound.PHASES.PUBLISHED }, { transacting, patch: true })
        transitionCount++
      }

      // Transition from published to submissions
      const submissionsOpeningRounds = await FundingRound.query(q => {
        q.where('deactivated_at', null)
        q.whereNotNull('submissions_open_at')
        q.where('phase', FundingRound.PHASES.PUBLISHED)
        q.where('submissions_open_at', '<=', now)
      }).fetchAll({ transacting })

      for (const round of submissionsOpeningRounds.models) {
        await round.save({ phase: FundingRound.PHASES.SUBMISSIONS }, { transacting, patch: true })
        Queue.classMethod('FundingRound', 'sendPhaseTransitionNotifications', { roundId: round.id, phase: FundingRound.PHASES.SUBMISSIONS })
        transitionCount++
      }

      // TODO: if going from published to voting straight dont send notifications for 3 transitions

      // Transition from submissions to discussion
      const submissionsClosingRounds = await FundingRound.query(q => {
        q.where('deactivated_at', null)
        q.whereNotNull('submissions_close_at')
        q.where('phase', FundingRound.PHASES.SUBMISSIONS)
        q.where('submissions_close_at', '<=', now)
      }).fetchAll({ transacting })

      for (const round of submissionsClosingRounds.models) {
        await round.save({ phase: FundingRound.PHASES.DISCUSSION }, { transacting, patch: true })
        Queue.classMethod('FundingRound', 'sendPhaseTransitionNotifications', { roundId: round.id, phase: FundingRound.PHASES.DISCUSSION })
        transitionCount++
      }

      // Transition from submissions or discussion to voting
      const votingOpeningRounds = await FundingRound.query(q => {
        q.where('deactivated_at', null)
        q.whereNotNull('voting_opens_at')
        q.whereIn('phase', [FundingRound.PHASES.SUBMISSIONS, FundingRound.PHASES.DISCUSSION])
        q.where('voting_opens_at', '<=', now)
      }).fetchAll({ transacting })

      for (const round of votingOpeningRounds.models) {
        try {
          await FundingRound.distributeTokens(round, { transacting })
        } catch (error) {
          console.error('Error distributing tokens for round:', round.id, error)
          continue
        }
        await round.save({ phase: FundingRound.PHASES.VOTING }, { transacting, patch: true })
        Queue.classMethod('FundingRound', 'sendPhaseTransitionNotifications', { roundId: round.id, phase: FundingRound.PHASES.VOTING })
        transitionCount++
      }

      // Transition from voting to completed
      const votingClosingRounds = await FundingRound.query(q => {
        q.where('deactivated_at', null)
        q.whereNotNull('voting_closes_at')
        q.where('phase', FundingRound.PHASES.VOTING)
        q.where('voting_closes_at', '<=', now)
      }).fetchAll({ transacting })

      for (const round of votingClosingRounds.models) {
        await round.save({ phase: FundingRound.PHASES.COMPLETED }, { transacting, patch: true })
        Queue.classMethod('FundingRound', 'sendPhaseTransitionNotifications', { roundId: round.id, phase: FundingRound.PHASES.COMPLETED })
        transitionCount++
      }

      return transitionCount
    })
  },

  create: async function (attrs, userId) {
    attrs.voting_method = attrs.voting_method || 'token_allocation_constant'
    // Dual-write display fields onto leftover NOT NULL columns until the
    // in-progress drop-column migration ships. Source of truth is the space group.
    if (!attrs.title && attrs.group_id) {
      const space = await Group.find(attrs.group_id)
      attrs.title = (space && space.get('name')) || 'Untitled'
      if (attrs.description === undefined) attrs.description = space ? space.get('description') : null
      if (attrs.banner_url === undefined) attrs.banner_url = space ? space.get('banner_url') : null
    }
    if (!attrs.title) attrs.title = 'Untitled'

    return await bookshelf.transaction(async transacting => {
      const round = this.forge({ created_at: new Date(), updated_at: new Date(), ...attrs })
      await round.save({}, { transacting })

      // Create the special chat room for this round
      const topic = await Tag.findOrCreate('‡funding_round_' + round.id, { transacting })
      await Tag.addToGroup({ group_id: attrs.group_id, tag_id: topic.id, isSubscribing: true }, { transacting })

      // Add creator as a participant (space membership)
      await FundingRound.join(round, userId, { transacting })

      return round
    })
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return FundingRound.where({ id }).query(q => {
      q.where('deactivated_at', null)
    }).fetch()
  },

  /**
   * Join a funding round by joining its space. Returns the GroupMembership.
   */
  join: async function (roundOrId, userId, { transacting } = {}) {
    if (!transacting) {
      return bookshelf.transaction(async trx => {
        return await FundingRound.join(roundOrId, userId, { transacting: trx })
      })
    }

    const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)
    if (!round) {
      throw new GraphQLError('Funding Round not found')
    }

    const space = await round.group().fetch({ transacting })
    if (!space) {
      throw new GraphQLError('Funding round space not found')
    }

    let membership = await GroupMembership.forPair(userId, space, { includeInactive: true }).fetch({ transacting })
    if (membership && membership.get('active')) {
      return membership
    }

    const created = await space.addMembers([userId], {}, { transacting })
    membership = created[0] || await GroupMembership.forPair(userId, space).fetch({ transacting })
    await membership.save({ created_at: new Date() }, { patch: true, transacting })
    await round.save({ num_participants: (round.get('num_participants') || 0) + 1 }, { transacting })

    return membership
  },

  /**
   * Leave a funding round by leaving its space (deactivates membership).
   */
  leave: async function (roundId, userId) {
    return bookshelf.transaction(async transacting => {
      const round = await FundingRound.find(roundId)
      if (!round) {
        throw new GraphQLError('Funding round not found')
      }
      const space = await round.group().fetch({ transacting })
      if (!space) return null

      const membership = await participationMembership(round, userId, { transacting, includeInactive: true })
      if (!membership || !membership.get('active')) {
        return null
      }

      // num_participants and the tokensRemaining setting are settled by Group.removeMembers,
      // so that leaving the parent group cascades the same way.
      await space.removeMembers([userId], { transacting })
      return membership
    })
  },

  // Distribute tokens to all eligible participants via membership settings
  distributeTokens: async function (roundOrId, { transacting } = {}) {
    const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)

    if (!round) {
      throw new GraphQLError('Funding Round not found')
    }

    // Check if tokens have already been distributed (phase is voting or completed)
    const phase = round.get('phase')
    if (phase === FundingRound.PHASES.VOTING || phase === FundingRound.PHASES.COMPLETED) {
      return round
    }

    // Check if voting has opened (allow up to 1 minute tolerance for timing issues)
    const votingOpensAt = round.get('voting_opens_at')
    if (!votingOpensAt) {
      throw new GraphQLError('Voting has not been scheduled')
    }
    const votingDate = new Date(votingOpensAt)
    const now = new Date()
    const oneMinuteFromNow = new Date(now.getTime() + 60000) // 1 minute buffer
    if (votingDate > oneMinuteFromNow) {
      throw new GraphQLError('Voting has not opened yet')
    }

    const votingMethod = round.get('voting_method')
    const totalTokens = round.get('total_tokens')

    if (!totalTokens) {
      throw new GraphQLError('Total tokens not set for this round')
    }

    const spaceId = round.get('group_id')
    const memberships = await GroupMembership.query(q => {
      q.where({ group_id: spaceId, active: true })
    }).fetchAll({ transacting })

    if (memberships.length === 0) {
      throw new GraphQLError('No users in this round')
    }

    // Filter users by voter roles if specified
    const voterRolesData = round.get('voter_roles')
    let eligibleMemberships = memberships.models

    if (voterRolesData && voterRolesData.length > 0) {
      const eligibleChecks = await Promise.all(
        memberships.models.map(async (membership) => {
          const canVote = await round.canUserVote(membership.get('user_id'))
          return { membership, canVote }
        })
      )
      eligibleMemberships = eligibleChecks
        .filter(({ canVote }) => canVote)
        .map(({ membership }) => membership)

      if (eligibleMemberships.length === 0) {
        console.error('No users with required voter roles in this round')
        return round
      }
    }

    let tokensPerUser = totalTokens

    // Calculate tokens per user based on voting method
    if (votingMethod === 'token_allocation_divide') {
      tokensPerUser = Math.floor(totalTokens / eligibleMemberships.length)
    }

    // Distribute tokens to each eligible participant
    await Promise.all(eligibleMemberships.map(async (membership) => {
      membership.addSetting({ tokensRemaining: tokensPerUser })
      await membership.save({ settings: membership.get('settings') }, { transacting, patch: true })
    }))

    return round
  },

  // Clear all token allocations and reset distribution status
  clearTokenDistribution: async function (roundOrId, { transacting } = {}) {
    const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)

    if (!round) {
      throw new GraphQLError('Funding Round not found')
    }

    const spaceId = round.get('group_id')

    // Reset all participant token balances on space memberships
    const memberships = await GroupMembership.query(q => {
      q.where({ group_id: spaceId, active: true })
    }).fetchAll({ transacting })

    await Promise.all(memberships.models.map(async (membership) => {
      membership.addSetting({ tokensRemaining: 0 })
      await membership.save({ settings: membership.get('settings') }, { transacting, patch: true })
    }))

    // Clear all token allocations on submissions
    const submissions = await round.submissions().fetch({ transacting })
    const submissionIds = submissions.pluck('id')

    if (submissionIds.length > 0) {
      await bookshelf.knex('posts_users')
        .whereIn('post_id', submissionIds)
        .update({ tokens_allocated_to: 0 })
        .transacting(transacting)
    }

    return round
  },

  // Notification methods
  sendPhaseTransitionNotifications,
  sendReminderNotifications,
  notifyStewardsOfSubmission
})
