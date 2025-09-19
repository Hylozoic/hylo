/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'funding_rounds',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  }
}, {
  create: function (attrs) {
    attrs.voting_method = attrs.voting_method || 'token_allocation'

    const round = this.forge({ created_at: new Date(), updated_at: new Date(), ...attrs })
    return round.save()
  }
})
