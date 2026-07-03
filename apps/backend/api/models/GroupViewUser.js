/* global bookshelf, GroupView, User */
/* eslint-disable camelcase */

// See docs/spaces-and-views-engineering-spec.md section 2.6 / 3.2

module.exports = bookshelf.Model.extend({
  tableName: 'group_views_users',
  requireFetch: false,
  hasTimestamps: true,

  view () {
    return this.belongsTo(GroupView, 'view_id')
  },

  user () {
    return this.belongsTo(User, 'user_id')
  }

}, {
  findOrCreate: async function (viewId, userId, { transacting } = {}) {
    let viewUser = await GroupViewUser.where({ view_id: viewId, user_id: userId }).fetch({ transacting })
    if (!viewUser) {
      const now = new Date()
      viewUser = await GroupViewUser.forge({
        view_id: viewId,
        user_id: userId,
        new_post_count: 0,
        created_at: now,
        updated_at: now
      }).save(null, { transacting, method: 'insert' })
    }
    return viewUser
  },

  markRead: async function (viewId, userId, { transacting } = {}) {
    const viewUser = await GroupViewUser.findOrCreate(viewId, userId, { transacting })
    const lastPost = await bookshelf.knex('posts')
      .max('id as max')
      .modify(q => { if (transacting) q.transacting(transacting) })
      .then(rows => rows[0]?.max)

    return viewUser.save({
      new_post_count: 0,
      last_read_post_id: lastPost || viewUser.get('last_read_post_id')
    }, { transacting, patch: true })
  },

  // Increment new_post_count for every given user's row for a view. Rows are
  // created on demand for users who don't have one yet (e.g. legacy members).
  incrementNewPostCount: async function (viewId, userIds, { transacting } = {}) {
    if (!userIds || userIds.length === 0) return

    for (const userId of userIds) {
      await GroupViewUser.findOrCreate(viewId, userId, { transacting })
    }

    await bookshelf.knex('group_views_users')
      .where('view_id', viewId)
      .whereIn('user_id', userIds)
      .increment('new_post_count', 1)
      .modify(q => { if (transacting) q.transacting(transacting) })
  }
})
