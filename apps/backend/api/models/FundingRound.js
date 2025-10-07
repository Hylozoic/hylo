/* eslint-disable camelcase */
import { GraphQLError } from 'graphql'

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds',
  requireFetch: false,
  hasTimestamps: true,

  initialize: function () {
    this._roundUserCache = {}
  },

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  submissions: function () {
    return this.belongsToMany(Post, 'funding_rounds_posts')
      .query(q => {
        q.where('posts.active', true)
        q.where('posts.type', Post.Type.SUBMISSION)
      })
      .orderBy('funding_rounds_posts.id', 'asc')
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

  _loadRoundUser: function (userId) {
    if (!this._roundUserCache[userId]) {
      this._roundUserCache[userId] = this.roundUser(userId).fetch()
    }
    return this._roundUserCache[userId]
  },

  isParticipating: function (userId) {
    return this._loadRoundUser(userId).then(roundUser => !!roundUser)
  },

  userSettings: function (userId) {
    return this._loadRoundUser(userId).then(roundUser => roundUser && roundUser.get('settings'))
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
  }
})
