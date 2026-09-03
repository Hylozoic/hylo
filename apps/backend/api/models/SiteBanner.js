module.exports = bookshelf.Model.extend({
  tableName: 'site_banners',
  requireFetch: false,
  hasTimestamps: true,

  creator: function () {
    return this.belongsTo(User, 'created_by_id')
  }
}, {
  find: function (id) {
    if (!id) return Promise.resolve(null)
    return SiteBanner.where({ id }).fetch()
  },

  all: function () {
    return SiteBanner.collection().query(q => q.orderBy('created_at', 'desc')).fetch()
  },

  // Active banners (published, not taken down) that this user has not dismissed
  activeForUser: function (userId) {
    return SiteBanner.collection().query(q => {
      q.whereNotNull('published_at')
        .whereNull('unpublished_at')
        .whereNotExists(function () {
          this.select(bookshelf.knex.raw('1'))
            .from('site_banners_users')
            .whereRaw('site_banners_users.site_banner_id = site_banners.id')
            .where('site_banners_users.user_id', userId)
        })
        .orderBy('published_at', 'desc')
    }).fetch()
  },

  dismiss: function (bannerId, userId) {
    return bookshelf.knex.raw(`
      INSERT INTO site_banners_users (site_banner_id, user_id)
      VALUES (?, ?)
      ON CONFLICT (site_banner_id, user_id) DO NOTHING
    `, [bannerId, userId])
  },

  dismissedCount: async function (bannerId) {
    const result = await bookshelf.knex('site_banners_users')
      .where({ site_banner_id: bannerId })
      .count('id as count')
      .first()
    return Number(result?.count) || 0
  }
})
