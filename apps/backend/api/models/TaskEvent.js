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
    EDITED: 'edited',
    DUE_REMINDER: 'due_reminder'
  },

  /** A group's task activity over the last few days, oldest first (reminders bookkeeping excluded). */
  recentForGroup: function (groupId, sinceDaysAgo = 1) {
    const days = Math.max(0, Math.min(Number(sinceDaysAgo) || 0, 14)) + 1
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return TaskEvent.query(q => {
      q.join('posts', 'posts.id', 'task_events.post_id')
      q.where({ 'task_events.group_id': groupId, 'posts.active': true })
      q.where('task_events.created_at', '>', since)
      q.whereNot('task_events.type', TaskEvent.Type.DUE_REMINDER)
      q.orderBy('task_events.created_at', 'asc').orderBy('task_events.id', 'asc')
      q.limit(500)
      q.select('task_events.*')
    }).fetchAll().then(result => result.models)
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
