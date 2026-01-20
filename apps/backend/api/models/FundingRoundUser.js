/* eslint-disable camelcase  */
import HasSettings from './mixins/HasSettings' // TODO: does it have settings?

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'funding_rounds_users',
  requireFetch: false,
  hasTimestamps: true,

  fundingRound: function () {
    return this.belongsTo(FundingRound, 'funding_round_id')
  },

  user: function () {
    return this.belongsTo(User, 'user_id')
  }

}, HasSettings), {
  create: async function (attrs, { transacting } = {}) {
    attrs.settings = attrs.settings || { }
    return this.forge(Object.assign({ created_at: new Date(), updated_at: new Date() }, attrs)).save({}, { transacting })
  },

  join: function (roundId, userId) {
    return FundingRoundUser.where({ funding_round_id: roundId, user_id: userId })
      .fetch()
      .then(roundUser => {
        if (roundUser) {
          return roundUser.save({ updatedAt: new Date() })
        } else {
          return TrackUser.create({ funding_round_id: roundId, user_id: userId })
        }
      })
  },

  selectIdsForMember: function (userId, where) {
    return FundingRoundUser.where({ user_id: userId }).where(where).pluck('funding_round_id')
  }
})
