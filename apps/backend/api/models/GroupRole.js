/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'groups_roles',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  responsibilities: function () {
    return this.belongsToMany(Responsibility, 'group_roles_responsibilities', 'group_role_id', 'responsibility_id')
  },

  trustExpressions: function () {
    return this.hasMany(TrustExpression, 'group_role_id')
  },

  stewards: function () {
    // Use membership-role pivot so stewardship data stays in sync with responsibilities
    return this.belongsToMany(User, 'group_memberships_group_roles', 'group_role_id', 'user_id')
      .query(qb => qb.where('group_memberships_group_roles.active', true))
  },

  candidates: function () {
    return this.belongsToMany(User, 'trust_expressions', 'group_role_id', 'trustee_id')
      .query(qb => {
        qb.where('trust_expressions.value', 1)
        qb.whereRaw('trust_expressions.trustor_id = trust_expressions.trustee_id')
      })
      .withPivot(['group_role_id', 'value'])
  }
}, {

})
