module.exports = bookshelf.Model.extend({
  tableName: 'context_widgets',
  requireFetch: false,
  hasTimestamps: true,

  // Relationships
  group() {
    return this.belongsTo(Group, 'group_id')
  },

  parent() {
    return this.belongsTo(ContextWidget, 'parent_id')
  },

  children() {
    return this.hasMany(ContextWidget, 'parent_id')
  },

  viewGroup() {
    return this.belongsTo(Group, 'view_group_id')
  },

  viewPost() {
    return this.belongsTo(Post, 'view_post_id') 
  },

  customView() {
    return this.belongsTo(CustomView, 'custom_view_id')
  },

  viewUser() {
    return this.belongsTo(User, 'view_user_id')
  },

  viewChat() {
    return this.belongsTo(Tag, 'view_chat_id')
  }

}, {
  // Static methods
  create: async function(attributes) {
    return await this.forge({
      ...attributes,
      created_at: new Date(),
      updated_at: new Date()
    }).save()
  },

  find: function(id, options = {}) {
    if (!id) return Promise.resolve(null)
    return this.where({id}).fetch(options)
  },

  findForGroup: function(groupId, options = {}) {
    return this.where({group_id: groupId})
      .orderBy('order', 'asc')
      .fetchAll(options)
  }
})
