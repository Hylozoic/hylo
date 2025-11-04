/* eslint-disable camelcase  */

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds_posts',
  requireFetch: false,
  hasTimestamps: true,

  post: function () {
    return this.belongsTo(Post, 'post_id')
  },

  fundingRound: function () {
    return this.belongsTo(FundingRound, 'funding_round_id')
  }
}, {
  create: async function (attrs, { transacting } = {}) {
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  }
})
