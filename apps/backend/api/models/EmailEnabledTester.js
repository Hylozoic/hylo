module.exports = bookshelf.Model.extend({
  tableName: 'email_enabled_testers',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  }
}, {
  create: async function (userId) {
    const existing = await EmailEnabledTester.where({ user_id: userId }).fetch()
    if (existing) {
      return existing
    }
    return EmailEnabledTester.forge({ user_id: userId }).save()
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return EmailEnabledTester.where({ id }).fetch()
  },

  findAll: function () {
    return EmailEnabledTester.query().orderBy('created_at', 'desc')
  },

  findByUserId: function (userId) {
    return EmailEnabledTester.where({ user_id: userId }).fetch()
  },

  delete: async function (userId) {
    await EmailEnabledTester.query().where({ user_id: userId }).del()
    return userId
  }
})

