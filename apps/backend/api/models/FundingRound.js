/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  submitterRole: function () {
    if (this.get('submitter_role_type') === 'common') {
      return this.belongsTo(CommonRole, 'submitter_role_id')
    } else {
      return this.belongsTo(GroupRole, 'submitter_role_id')
    }
  },

  voterRole: function () {
    if (this.get('voter_role_type') === 'common') {
      return this.belongsTo(CommonRole, 'voter_role_id')
    } else {
      return this.belongsTo(GroupRole, 'voter_role_id')
    }
  }
}, {
  create: function (attrs) {
    attrs.voting_method = attrs.voting_method || 'token_allocation_constant'

    const round = this.forge({ created_at: new Date(), updated_at: new Date(), ...attrs })
    return round.save()
  }
})
