/**
 * A column on a group's (or space's) Tasks board. The name is free text; the category
 * (todo / active / done) is what the platform uses to know whether a task is complete.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'task_statuses',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  }
}, {
  Category: {
    TODO: 'todo',
    ACTIVE: 'active',
    DONE: 'done'
  },

  CATEGORIES: ['todo', 'active', 'done'],

  DEFAULTS: [
    { name: 'To do', category: 'todo' },
    { name: 'In progress', category: 'active' },
    { name: 'Ready for review', category: 'active' },
    { name: 'Complete', category: 'done' }
  ],

  find: function (id, opts) {
    if (!id) return Promise.resolve(null)
    return TaskStatus.where({ id }).fetch(opts)
  },

  /** A group's columns in board order. */
  forGroup: function (groupId, { transacting } = {}) {
    return TaskStatus.query(q => {
      q.where('group_id', groupId)
      q.orderBy('order', 'asc').orderBy('id', 'asc')
    }).fetchAll({ transacting }).then(result => result.models)
  },

  /**
   * A group's columns, creating the default four when it has none.
   * Takes a per-group advisory lock so two requests can't both seed the defaults.
   */
  ensureForGroup: async function (groupId, { transacting } = {}) {
    const existing = await TaskStatus.forGroup(groupId, { transacting })
    if (existing.length > 0) return existing

    const seed = async trx => {
      await trx.raw('select pg_advisory_xact_lock(hashtext(?), ?)', ['task_statuses', Number(groupId)])
      const current = await TaskStatus.forGroup(groupId, { transacting: trx })
      if (current.length > 0) return current
      for (let i = 0; i < TaskStatus.DEFAULTS.length; i++) {
        await TaskStatus.forge({ group_id: groupId, order: i, ...TaskStatus.DEFAULTS[i] }).save(null, { transacting: trx })
      }
      return TaskStatus.forGroup(groupId, { transacting: trx })
    }

    return transacting ? seed(transacting) : bookshelf.knex.transaction(seed)
  },

  /** The first column of a category, or null when the board has none. */
  firstOfCategory: function (statuses, category) {
    return statuses.find(s => s.get('category') === category) || null
  }
})
