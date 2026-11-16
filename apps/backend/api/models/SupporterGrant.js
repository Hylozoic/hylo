// Supporter status given by Hylo staff (e.g. for non-monetary contributions)
// to exactly one user or one group. Revoking keeps the row for the record.
module.exports = bookshelf.Model.extend({
  tableName: 'supporter_grants',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  },

  group: function () {
    return this.belongsTo(Group)
  },

  grantedBy: function () {
    return this.belongsTo(User, 'granted_by_id')
  }
}, {
  // Grants that are neither revoked nor expired
  active: function (now = new Date()) {
    return SupporterGrant.query(q => {
      q.whereNull('revoked_at')
      q.where(function () {
        this.whereNull('expires_at').orWhere('expires_at', '>', now)
      })
    })
  }
})
