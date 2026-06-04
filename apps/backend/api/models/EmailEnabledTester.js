module.exports = bookshelf.Model.extend({
  tableName: 'email_enabled_testers',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  }
}, {
  create: async function (userId) {
    const existing = await EmailEnabledTester.where({ user_id: userId }).fetch({ withRelated: ['user'] })
    if (existing) {
      return existing
    }
    const tester = await EmailEnabledTester.forge({ user_id: userId }).save()
    return tester.fetch({ withRelated: ['user'] })
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return EmailEnabledTester.where({ id }).fetch()
  },

  findAll: function () {
    return bookshelf.knex('email_enabled_testers')
      .orderBy('created_at', 'desc')
      .then(rows => {
        return EmailEnabledTester.collection(rows.map(row => EmailEnabledTester.forge(row)))
      })
  },

  findByUserId: function (userId) {
    return EmailEnabledTester.where({ user_id: userId }).fetch()
  },

  delete: async function (userId) {
    await EmailEnabledTester.query().where({ user_id: userId }).del()
    return userId
  }
})

