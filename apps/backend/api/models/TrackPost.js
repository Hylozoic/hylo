/* eslint-disable camelcase  */

module.exports = bookshelf.Model.extend({
  tableName: 'tracks_posts',
  requireFetch: false,
  hasTimestamps: true,

  post: function () {
    return this.belongsTo(Post, 'post_id')
  },

  track: function () {
    return this.belongsTo(Track, 'track_id')
  }
}, {
  create: async function (attrs, { transacting } = {}) {
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  }
})
