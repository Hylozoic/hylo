/* global bookshelf, Group, Post, User, GroupViewUser, CollectionPost, GroupViewPin, GroupView */
/* eslint-disable camelcase */

const { homeRoutePathForView } = require('@hylo/navigation')

// See docs/spaces-and-views-engineering-spec.md section 2.5 / 3.1

module.exports = bookshelf.Model.extend({
  tableName: 'group_views',
  requireFetch: false,
  hasTimestamps: true,

  group () {
    return this.belongsTo(Group, 'group_id')
  },

  linkedGroup () {
    return this.belongsTo(Group, 'linked_group_id')
  },

  viewPost () {
    return this.belongsTo(Post, 'post_id')
  },

  viewUser () {
    return this.belongsTo(User, 'user_id')
  },

  collectionPosts () {
    return this.hasMany(CollectionPost, 'view_id').query(q => q.orderBy('order', 'asc'))
  },

  pins () {
    return this.hasMany(GroupViewPin, 'view_id').query(q => q.orderBy('pinned_at', 'desc'))
  },

  viewsUsers () {
    return this.hasMany(GroupViewUser, 'view_id')
  }

}, {
  Type: {
    ALL: 'all',
    CHAT: 'chat',
    COLLECTION: 'collection',
    CUSTOM: 'custom',
    DISCUSSIONS: 'discussions',
    EVENTS: 'events',
    FUNDING_ROUND_SUBMISSIONS: 'funding-round-submissions',
    GROUP: 'group',
    LINK: 'link',
    MAP: 'map',
    MEMBER: 'member',
    MEMBERS: 'members',
    POST: 'post',
    PROJECTS: 'projects',
    PROPOSALS: 'proposals',
    REQUESTS_AND_OFFERS: 'requests-and-offers',
    RESOURCES: 'resources',
    SEPARATOR: 'separator',
    SPACE: 'space',
    SPACE_COLLECTION: 'space-collection',
    TEXT: 'text',
    TRACK_ACTIONS: 'track-actions',
    WELCOME: 'welcome'
  },

  // Only spaces can live off-menu (order = null) — that's More Spaces.
  // Views are either in the menu or deleted.
  SOFT_REMOVE_TYPES: [
    'space'
  ],

  // View types that are not real routes / don't get their own GroupView page
  NON_NAVIGABLE_TYPES: ['link', 'text', 'separator', 'space'],

  // Ordered menu views only — excludes hidden views (order = null).
  findForGroup: function (groupId, options = {}) {
    return this.where({ group_id: groupId })
      .query(q => q.whereNotNull('order').orderBy('order', 'asc'))
      .fetchAll(options)
  },

  findHomeView: function (groupId, options = {}) {
    return this.where({ group_id: groupId, order: 0 }).fetch(options)
  },

  /**
   * Insert a new view at the end of a group's/space's ordered menu list.
   */
  appendToMenu: async function (attrs, { transacting } = {}) {
    const now = new Date()
    const maxOrderRow = await bookshelf.knex('group_views')
      .where({ group_id: attrs.group_id })
      .max('order as max_order')
      .modify(q => { if (transacting) q.transacting(transacting) })
      .first()
    const nextOrder = maxOrderRow && maxOrderRow.max_order != null ? Number(maxOrderRow.max_order) + 1 : 0

    return GroupView.forge({
      ...attrs,
      order: nextOrder,
      created_at: now,
      updated_at: now
    }).save(null, { transacting, method: 'insert' })
  },

  /**
   * Insert a new view off-menu (order = null). Used only for space menu rows
   * that live in More Spaces rather than the parent menu.
   */
  createOffMenu: async function (attrs, { transacting } = {}) {
    const now = new Date()
    return GroupView.forge({
      ...attrs,
      order: null,
      created_at: now,
      updated_at: now
    }).save(null, { transacting, method: 'insert' })
  },

  /**
   * Best-effort route suffix (appended after /groups/:slug for a main group,
   * or the equivalent space base path) for a given view. Used to populate
   * groups.home_route so the frontend can redirect without loading all views.
   * NOTE: exact space URL wiring lands with the Phase 2 routing work.
   */
  computeHomeRoutePath: function (view, group) {
    return homeRoutePathForView(view)
  },

  /**
   * Move a view to a new position within its group's single ordered menu list.
   * No nesting — order is just an ascending integer per group, 0 = home.
   */
  reorder: async function ({ id, addToEnd, orderInFrontOfViewId, trx: existingTrx }) {
    const doWork = async (trx) => {
      const view = await GroupView.where({ id }).fetch({ transacting: trx })
      if (!view) throw new Error('View not found')

      const groupId = view.get('group_id')
      const views = await GroupView.findForGroup(groupId, { transacting: trx })
      // bigint PKs come back as strings from node-postgres; normalise to Number for safe comparison
      const numId = Number(id)
      const otherIds = views.map(v => Number(v.id)).filter(viewId => viewId !== numId)

      let newOrderedIds = [...otherIds, numId]
      if (!addToEnd && orderInFrontOfViewId) {
        const numFrontId = Number(orderInFrontOfViewId)
        const idx = otherIds.indexOf(numFrontId)
        if (idx !== -1) {
          newOrderedIds = [...otherIds.slice(0, idx), numId, ...otherIds.slice(idx)]
        }
      }

      await GroupView.applyOrder(newOrderedIds, { groupId, trx })

      return GroupView.where({ id }).fetch({ transacting: trx })
    }

    if (existingTrx) return doWork(existingTrx)
    return bookshelf.transaction(trx => doWork(trx))
  },

  /**
   * Set a view as the home view (order = 0), shifting all other views in the
   * group down to fill 1, 2, 3... in their existing relative order.
   */
  setHomeView: async function ({ id, groupId, trx: existingTrx }) {
    const doWork = async (trx) => {
      const views = await GroupView.findForGroup(groupId, { transacting: trx })
      // bigint PKs come back as strings from node-postgres; normalise to Number for safe comparison
      const numId = Number(id)
      const otherIds = views.map(v => Number(v.id)).filter(viewId => viewId !== numId)
      const newOrderedIds = [numId, ...otherIds]

      await GroupView.applyOrder(newOrderedIds, { groupId, trx })

      const homeView = await GroupView.where({ id }).fetch({ transacting: trx })
      const group = await Group.where({ id: groupId }).fetch({ transacting: trx })
      if (homeView && group) {
        const homeRoute = GroupView.computeHomeRoutePath(homeView, group)
        await bookshelf.knex('groups').where({ id: groupId }).update({ home_route: homeRoute }).transacting(trx)
      }

      return { success: true }
    }

    if (existingTrx) return doWork(existingTrx)
    return bookshelf.transaction(trx => doWork(trx))
  },

  // Persist order = index in newOrderedIds (0-based) for every id in the list.
  applyOrder: async function (newOrderedIds, { groupId, trx }) {
    if (newOrderedIds.length === 0) return

    const query = `
      UPDATE group_views
      SET "order" = CASE id
        ${newOrderedIds.map((viewId, index) => `WHEN ${viewId} THEN ${index}`).join('\n')}
      END
      WHERE id IN (${newOrderedIds.join(',')})
    `
    await bookshelf.knex.raw(query).transacting(trx)
  }
})
