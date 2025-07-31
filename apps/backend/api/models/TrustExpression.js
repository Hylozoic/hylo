/* eslint-disable camelcase, no-undef, no-trailing-spaces, eol-last */
module.exports = bookshelf.Model.extend({
  tableName: 'trust_expressions',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  role: function () {
    return this.belongsTo(GroupRole, 'group_role_id')
  },

  trustor: function () {
    return this.belongsTo(User, 'trustor_id')
  },

  trustee: function () {
    return this.belongsTo(User, 'trustee_id')
  }
}, {

}) 