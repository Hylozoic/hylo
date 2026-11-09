/* global bookshelf, GroupView, Post */
/* eslint-disable camelcase */

// Join row for a post pinned to a GroupView. See
// docs/spaces-and-views-engineering-spec.md (pinned posts per view).

module.exports = bookshelf.Model.extend({
  tableName: 'group_view_pins',
  requireFetch: false,

  view () {
    return this.belongsTo(GroupView, 'view_id')
  },

  post () {
    return this.belongsTo(Post, 'post_id')
  }
}, {
  create: async function (attrs, { transacting } = {}) {
    return this.forge(attrs).save(null, { transacting, method: 'insert' })
  },

  find: function (viewId, postId, options = {}) {
    return this.where({ view_id: viewId, post_id: postId }).fetch(options)
  },

  countForView: async function (viewId, { transacting } = {}) {
    const row = await bookshelf.knex('group_view_pins')
      .where({ view_id: viewId })
      .count('* as count')
      .modify(q => { if (transacting) q.transacting(transacting) })
      .first()
    return Number(row?.count || 0)
  }
})
