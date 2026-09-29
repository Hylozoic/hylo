import { localeToTranslationKey } from '../../lib/localeHelpers'

// Languages a banner can be translated into; the banner's own fields are the English text
const TRANSLATION_LOCALES = ['de', 'es', 'fr', 'hi', 'pt']
const TRANSLATABLE_FIELDS = ['title', 'text', 'action_text']

module.exports = bookshelf.Model.extend({
  tableName: 'site_banners',
  requireFetch: false,
  hasTimestamps: true,

  creator: function () {
    return this.belongsTo(User, 'created_by_id')
  },

  /**
   * A field in the given language, falling back to the English text when the
   * banner has no translation for it. field is title, text or action_text.
   */
  localized: function (field, locale) {
    const key = locale ? localeToTranslationKey(locale) : null
    const translation = key && (this.get('translations') || {})[key]
    const value = translation && translation[field]
    return (typeof value === 'string' && value.trim()) ? value : this.get(field)
  }
}, {
  TRANSLATION_LOCALES,
  TRANSLATABLE_FIELDS,

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return SiteBanner.where({ id }).fetch()
  },

  all: function () {
    return SiteBanner.collection().query(q => q.orderBy('created_at', 'desc')).fetch()
  },

  // Active banners (published, not taken down) that this user has not dismissed.
  // Banners with show_to_new_users off are hidden from accounts created after publish.
  activeForUser: async function (userId) {
    const user = userId ? await User.find(userId) : null
    const userCreatedAt = user && user.get('created_at')

    return SiteBanner.collection().query(q => {
      q.whereNotNull('published_at')
        .whereNull('unpublished_at')
        .whereNotExists(function () {
          this.select(bookshelf.knex.raw('1'))
            .from('site_banners_users')
            .whereRaw('site_banners_users.site_banner_id = site_banners.id')
            .where('site_banners_users.user_id', userId)
        })

      if (userCreatedAt) {
        q.where(function () {
          this.where('show_to_new_users', true)
            .orWhere('published_at', '>=', userCreatedAt)
        })
      }

      q.orderBy('published_at', 'desc')
    }).fetch()
  },

  dismiss: function (bannerId, userId) {
    return bookshelf.knex.raw(`
      INSERT INTO site_banners_users (site_banner_id, user_id)
      VALUES (?, ?)
      ON CONFLICT (site_banner_id, user_id) DO NOTHING
    `, [bannerId, userId])
  },

  // Someone used the banner's action button: it's hidden for them like a
  // dismissal, and counted as a click rather than a dismissal
  click: function (bannerId, userId) {
    return bookshelf.knex.raw(`
      INSERT INTO site_banners_users (site_banner_id, user_id, clicked_at)
      VALUES (?, ?, now())
      ON CONFLICT (site_banner_id, user_id)
      DO UPDATE SET clicked_at = COALESCE(site_banners_users.clicked_at, EXCLUDED.clicked_at)
    `, [bannerId, userId])
  },

  // People who closed the banner without using its action button
  dismissedCount: async function (bannerId) {
    const result = await bookshelf.knex('site_banners_users')
      .where({ site_banner_id: bannerId })
      .whereNull('clicked_at')
      .count('id as count')
      .first()
    return Number(result?.count) || 0
  },

  clickedCount: async function (bannerId) {
    const result = await bookshelf.knex('site_banners_users')
      .where({ site_banner_id: bannerId })
      .whereNotNull('clicked_at')
      .count('id as count')
      .first()
    return Number(result?.count) || 0
  },

  /**
   * Keeps only known languages and fields, as trimmed non-empty strings:
   * { de: { title, text, action_text }, ... }. Accepts actionText for action_text.
   */
  sanitizeTranslations: function (translations) {
    if (!translations || typeof translations !== 'object' || Array.isArray(translations)) return {}
    const clean = {}
    for (const locale of TRANSLATION_LOCALES) {
      const entry = translations[locale]
      if (!entry || typeof entry !== 'object') continue
      const fields = {}
      for (const field of TRANSLATABLE_FIELDS) {
        const value = field === 'action_text' ? (entry.action_text ?? entry.actionText) : entry[field]
        if (typeof value === 'string' && value.trim()) fields[field] = value.trim()
      }
      if (Object.keys(fields).length > 0) clean[locale] = fields
    }
    return clean
  }
})
