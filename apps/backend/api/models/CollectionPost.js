/* global bookshelf, GroupView, Post */
/* eslint-disable camelcase */

// See docs/spaces-and-views-engineering-spec.md section 2.7 / 3.3
// Replaces the old PostCollection/CollectionsPost join model. Used both for
// steward-curated `collection` views and for ordering `track-actions` posts.

module.exports = bookshelf.Model.extend({
  tableName: 'collections_posts',
  requireFetch: false,
  hasTimestamps: true,

  view () {
    return this.belongsTo(GroupView, 'view_id')
  },

  post () {
    return this.belongsTo(Post, 'post_id')
  }

}, {
  create: async function (attrs, { transacting } = {}) {
    const now = new Date()
    return this.forge(Object.assign({ created_at: now, updated_at: now }, attrs)).save(null, { transacting, method: 'insert' })
  },

  find: function (viewId, postId, options = {}) {
    return this.where({ view_id: viewId, post_id: postId }).fetch(options)
  }
})
