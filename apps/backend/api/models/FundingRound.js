/* eslint-disable camelcase */
import { GraphQLError } from 'graphql'

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  submissions: function () {
    return this.belongsToMany(Post, 'funding_rounds_posts')
      .query(q => {
        q.where('posts.active', true)
        q.where('posts.type', Post.Type.SUBMISSION)
      })
      .orderBy('posts.id', 'asc')
  },

  submitterRole: function () {
    if (this.get('submitter_role_type') === 'common') {
      return this.belongsTo(CommonRole, 'submitter_role_id')
    } else {
      return this.belongsTo(GroupRole, 'submitter_role_id')
    }
  },

  roundUser: function (userId) {
    return FundingRoundUser.query(q => {
      q.where({
        user_id: userId,
        funding_round_id: this.get('id')
      })
    })
  },

  users: function () {
    return this.belongsToMany(User, 'funding_rounds_users', 'funding_round_id', 'user_id')
  },

  isParticipating: function (userId) {
    return this.roundUser(userId).fetch().then(roundUser => !!roundUser)
  },

  userSettings: function (userId) {
    return this.roundUser(userId).fetch().then(roundUser => roundUser && roundUser.get('settings'))
  },

  voterRole: function () {
    if (this.get('voter_role_type') === 'common') {
      return this.belongsTo(CommonRole, 'voter_role_id')
    } else {
      return this.belongsTo(GroupRole, 'voter_role_id')
    }
  }
}, {
  addPost: async function (postOrId, fundingRoundOrId, { transacting } = {}) {
    const postId = typeof postOrId === 'number' ? postOrId : postOrId.get('id')
    const fundingRound = await (typeof fundingRoundOrId === 'object' ? fundingRoundOrId : FundingRound.find(fundingRoundOrId))
    if (!fundingRound) {
      throw new GraphQLError('Funding Round not found')
    }

    await fundingRound.save({ num_submissions: fundingRound.get('num_submissions') + 1 }, { transacting })

    return FundingRoundPost.create({
      funding_round_id: fundingRound.get('id'),
      post_id: postId
    }, { transacting })
  },

  create: async function (attrs) {
    attrs.voting_method = attrs.voting_method || 'token_allocation_constant'

    return await bookshelf.transaction(async transacting => {
      const round = this.forge({ created_at: new Date(), updated_at: new Date(), ...attrs })
      round.save({}, { transacting })

      // Create the special chat room for this round
      const topic = await Tag.findOrCreate('‡funding_round_' + round.id, { transacting })
      await Tag.addToGroup({ group_id: attrs.group_id, tag_id: topic.id, isSubscribing: true, isChatRoom: true }, { transacting })

      return round
    })
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return FundingRound.where({ id }).fetch()
  },

  join: async function (roundId, userId) {
    return bookshelf.transaction(async transacting => {
      const round = await FundingRound.find(roundId, { transacting })
      if (!round) {
        throw new GraphQLError('Funding Round not found')
      }
      if (!round.get('published_at')) {
        throw new GraphQLError('Funding Round is not published')
      }
      let roundUser = await FundingRoundUser.where({ funding_round_id: roundId, user_id: userId }).fetch({ transacting })
      if (!roundUser) {
        roundUser = await FundingRoundUser.create({ funding_round_id: roundId, user_id: userId })
        await round.save({ num_participants: round.get('num_participants') + 1 }, { transacting })
        const group = await round.group().fetch({ transacting })
        const manageResponsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_ROUNDS }).fetch({ transacting })
        const stewards = await group.membersWithResponsibilities([manageResponsibility.id]).fetch({ transacting })
        const stewardsIds = stewards.pluck('id')
        const activities = stewardsIds.map(stewardId => ({
          reason: 'fundingRoundJoin',
          actor_id: userId,
          group_id: group.id,
          reader_id: stewardId,
          funding_round_id: round.id
        }))
        await Activity.saveForReasons(activities, { transacting })
      }
      return roundUser
    })
  },

  leave: async function (roundId, userId) {
    const round = await FundingRound.find(roundId)
    if (!round) {
      throw new GraphQLError('Funding round not found')
    }
    return FundingRoundUser.where({ funding_round_id: roundId, user_id: userId })
      .fetch()
      .then(roundUser => {
        if (roundUser) {
          roundUser.destroy()
          round.save({ num_participants: round.get('num_participants') - 1 })
          return true
        }
        return null
      })
  },

  // Distribute tokens to all users in a funding round
  distributeTokens: async function (roundOrId, { transacting } = {}) {
    const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)

    if (!round) {
      throw new GraphQLError('Funding Round not found')
    }

    const roundId = round.id

    // Check if tokens have already been distributed
    if (round.get('tokens_distributed_at')) {
      return round
    }

    // Check if voting has opened
    const votingOpensAt = round.get('voting_opens_at')
    if (!votingOpensAt || new Date(votingOpensAt) > new Date()) {
      throw new GraphQLError('Voting has not opened yet')
    }

    const votingMethod = round.get('voting_method')
    const totalTokens = round.get('total_tokens')

    if (!totalTokens) {
      throw new GraphQLError('Total tokens not set for this round')
    }

    // Get all users in the round
    const roundUsers = await FundingRoundUser.query(q => {
      q.where({ funding_round_id: roundId })
    }).fetchAll({ transacting })

    if (roundUsers.length === 0) {
      throw new GraphQLError('No users in this round')
    }

    let tokensPerUser = totalTokens

    // Calculate tokens per user based on voting method
    if (votingMethod === 'token_allocation_divide') {
      tokensPerUser = Math.floor(totalTokens / roundUsers.length)
    }

    // Distribute tokens to each user
    await Promise.all(roundUsers.map(async (roundUser) => {
      await roundUser.save({ tokens_remaining: tokensPerUser }, { transacting })
    }))

    // Mark tokens as distributed
    await round.save({ tokens_distributed_at: new Date().toISOString() }, { transacting })

    return round
  },

  // Clear all token allocations and reset distribution status
  clearTokenDistribution: async function (roundOrId, { transacting } = {}) {
    const round = typeof roundOrId === 'object' ? roundOrId : await FundingRound.find(roundOrId)

    if (!round) {
      throw new GraphQLError('Funding Round not found')
    }

    const roundId = round.id

    // Clear tokens_distributed_at
    await round.save({ tokens_distributed_at: null }, { transacting })

    // Reset all user token balances
    await bookshelf.knex('funding_rounds_users')
      .where({ funding_round_id: roundId })
      .update({ tokens_remaining: 0 })
      .transacting(transacting)

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
  }
})
