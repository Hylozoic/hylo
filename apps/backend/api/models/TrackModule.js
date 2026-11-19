/* global bookshelf, GroupView, CollectionPost */
/* eslint-disable camelcase */

// A module groups some of a track's actions (one level only, modules don't nest).
// It belongs to the track space's `track-actions` view.
//
// Ordering: track_modules.order and collections_posts.order share one number
// sequence per view. A module's number comes right before the numbers of the
// actions inside it, so sorting every action by `order` still gives the flat
// order of the whole track, and sorting modules together with the actions that
// have no module gives the top-level outline.

module.exports = bookshelf.Model.extend({
  tableName: 'track_modules',
  requireFetch: false,
  hasTimestamps: true,

  view () {
    return this.belongsTo(GroupView, 'view_id')
  },

  collectionPosts () {
    return this.hasMany(CollectionPost, 'module_id').query(q => q.orderBy('order', 'asc'))
  },

  opensAt () {
    const settings = this.get('settings') || {}
    return settings.opens_at ? new Date(settings.opens_at) : null
  },

  opensAfterPrevious () {
    const settings = this.get('settings') || {}
    return !!settings.opens_after_previous
  }
}, {
  create: async function (attrs, { transacting } = {}) {
    const now = new Date()
    return this.forge(Object.assign({ created_at: now, updated_at: now, settings: {} }, attrs)).save(null, { transacting, method: 'insert' })
  },

  find: function (id, options = {}) {
    if (!id) return Promise.resolve(null)
    return this.where({ id }).fetch(options)
  },

  /** The next free number in a view's shared order sequence (actions and modules). */
  nextOrderForView: async function (viewId, { transacting } = {}) {
    const maxOf = async table => {
      const row = await bookshelf.knex(table)
        .modify(q => { if (transacting) q.transacting(transacting) })
        .where({ view_id: viewId })
        .select(bookshelf.knex.raw('coalesce(max("order"), -1) as max_order'))
        .first()
      return Number(row.max_order)
    }
    return Math.max(await maxOf('collections_posts'), await maxOf('track_modules')) + 1
  },

  /**
   * Opens a gap at `order` in a view's shared sequence: every action and module
   * numbered `order` or higher moves up by one.
   */
  makeRoomAt: async function (viewId, order, { transacting } = {}) {
    for (const table of ['collections_posts', 'track_modules']) {
      await bookshelf.knex(table)
        .modify(q => { if (transacting) q.transacting(transacting) })
        .where({ view_id: viewId })
        .andWhere('order', '>=', order)
        .update({ order: bookshelf.knex.raw('?? + 1', ['order']) })
    }
  }
})
