// Links an Open Collective account to the Hylo user it belongs to.
// Only created when the user asks: the email check (method 'email') or the
// in-app donation flow (method 'intent'). One OC account maps to one user.
module.exports = bookshelf.Model.extend({
  tableName: 'supporter_links',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  }
}, {
  Method: {
    EMAIL: 'email',
    INTENT: 'intent',
    OAUTH: 'oauth'
  }
})
