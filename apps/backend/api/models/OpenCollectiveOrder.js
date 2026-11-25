// A contribution to Hylo's Open Collective, copied locally by OpenCollectiveService.syncOrders.
// The full OC payload is kept in raw; amounts are never exposed through GraphQL.
module.exports = bookshelf.Model.extend({
  tableName: 'open_collective_orders',
  requireFetch: false,
  hasTimestamps: true,

  attributedGroup: function () {
    return this.belongsTo(Group, 'attributed_group_id')
  },

  attributedBy: function () {
    return this.belongsTo(User, 'attributed_by_id')
  }
}, {
  findByOcId: function (ocOrderId, opts) {
    if (!ocOrderId) return Promise.resolve(null)
    return OpenCollectiveOrder.where({ oc_order_id: ocOrderId }).fetch(opts)
  }
})
