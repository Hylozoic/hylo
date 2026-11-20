/* global bookshelf, User */
module.exports = bookshelf.Model.extend({
  tableName: 'user_profile_links',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  }
}, {
  create: async function (opts) {
    const { userId, url, title } = opts
    const maxRow = await bookshelf.knex('user_profile_links')
      .where('user_id', userId)
      .max('sort_order as max_sort')
      .first()
    const maxSort = maxRow && maxRow.max_sort
    const sortOrder = maxSort == null ? 0 : Number(maxSort) + 1
    const profileLink = await this.forge({
      user_id: userId,
      url,
      title,
      sort_order: sortOrder,
      created_at: new Date(),
      updated_at: new Date()
    }).save()

    return profileLink
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return this.where({ id }).fetch()
  },

  delete: async function (id) {
    await this.query().where({ id }).del()
    return id
  },

  findByUser: function (userId) {
    return this.where({ user_id: userId }).query(q => {
      q.orderBy('sort_order').orderBy('id')
    }).fetchAll()
  }
})
