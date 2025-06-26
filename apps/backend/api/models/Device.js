// DEPRECATED: This is no longer used, remove after 2025-08-26
module.exports = bookshelf.Model.extend({
  tableName: 'devices',
  requireFetch: false,
  hasTimestamps: true,

  pushNotifications: function () {
    return this.hasMany(PushNotification)
  },

  user: function () {
    return this.belongsTo(User, 'user_id')
  }
}, {})
