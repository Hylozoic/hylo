// A donation started from Hylo. The token is sent to Open Collective as the
// public tag `hylo-<token>`, so it must stay opaque (never a user or group id).
module.exports = bookshelf.Model.extend({
  tableName: 'support_intents',
  requireFetch: false,
  hasTimestamps: ['created_at', null],

  user: function () {
    return this.belongsTo(User)
  },

  group: function () {
    return this.belongsTo(Group)
  }
}, {
  TAG_PREFIX: 'hylo-',

  tagFor: function (token) {
    return `${SupportIntent.TAG_PREFIX}${token}`
  },

  // The token from the first `hylo-<token>` tag, if any
  tokenFromTags: function (tags) {
    const tag = (tags || []).find(t => typeof t === 'string' && t.startsWith(SupportIntent.TAG_PREFIX))
    return tag ? tag.slice(SupportIntent.TAG_PREFIX.length) : null
  },

  findByToken: function (token, opts) {
    if (!token) return Promise.resolve(null)
    return SupportIntent.where({ token }).fetch(opts)
  }
})
