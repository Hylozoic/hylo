/**
 * One thing that happened to a task: created, moved, assigned, edited and so on.
 * Events are written per group so each board's daily summary only sees its own activity.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'task_events',
  requireFetch: false,

  post: function () {
    return this.belongsTo(Post)
  },

  group: function () {
    return this.belongsTo(Group)
  },

  actor: function () {
    return this.belongsTo(User, 'actor_id')
  }
}, {
  Type: {
    CREATED: 'created',
    MOVED: 'moved',
    COMPLETED: 'completed',
    REOPENED: 'reopened',
    ASSIGNED: 'assigned',
    UNASSIGNED: 'unassigned',
    EDITED: 'edited'
  },

  /** Writes one event for each of the given groups (or a single group-less event). */
  log: async function ({ postId, groupIds, actorId, type, meta = {} }, { transacting } = {}) {
    const ids = groupIds && groupIds.length > 0 ? groupIds : [null]
    const rows = ids.map(groupId => ({
      post_id: postId,
      group_id: groupId,
      actor_id: actorId || null,
      type,
      meta: JSON.stringify(meta),
      created_at: new Date()
    }))
    const insert = bookshelf.knex('task_events').insert(rows)
    if (transacting) insert.transacting(transacting)
    await insert
  }
})
