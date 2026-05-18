/* eslint-disable camelcase */
module.exports = bookshelf.Model.extend({
  tableName: 'subscription_change_events',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User, 'user_id')
  },

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  fromProduct: function () {
    return this.belongsTo(StripeProduct, 'from_product_id')
  },

  toProduct: function () {
    return this.belongsTo(StripeProduct, 'to_product_id')
  }
})
