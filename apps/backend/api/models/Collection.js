import { GraphQLError } from 'graphql'

module.exports = bookshelf.Model.extend({
  tableName: 'collections',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(User)
  },

  linkedPosts: function () {
    return this.hasMany(CollectionsPost, 'collection_id').orderBy('collections_posts.order', 'ASC')
  },

  posts: function () {
    return this.belongsToMany(Post).through(CollectionsPost).orderBy('collections_posts.order', 'ASC').withPivot(['order'])
  },

  user: function () {
    return this.belongsTo(User)
  }
}, {

  create: async function (attrs) {
    const { groupId, name, userId } = attrs

    const collection = await this.forge({
      group_id: groupId,
      name,
      user_id: userId
    }).save()

    return collection
  },

  find: function (id) {
    if (!id) return Promise.resolve(null)
    return Collection.where({ id, is_active: true }).fetch()
  },

  findValidCollectionForUser: async function (userId, id) {
    // Personal collections: creator only. Group collections: members with Manage Content.
    if (!id) {
      throw new GraphQLError('Not a valid collection')
    }
    const manageContent = await Responsibility.where({
      title: Responsibility.constants.RESP_MANAGE_CONTENT
    }).fetch()
    const collection = await Collection.query(q => {
      q.where({ id, is_active: true })
      q.andWhere(sub => {
        sub.where({ user_id: userId })
          .orWhereIn('group_id', Group.selectIdsByResponsibilities(userId, [manageContent.id]))
      })
    }).fetch()

    if (!collection) {
      throw new GraphQLError('Not a valid collection')
    }
    return collection
  },

  delete: async function (id) {
    const attributes = { updated_at: new Date(), is_active: false }
    await Collection.query().where({ id }).update(attributes)
    return id
  }

})
