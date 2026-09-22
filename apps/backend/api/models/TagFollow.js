/* eslint-disable camelcase  */
import HasSettings from './mixins/HasSettings'

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tag_follows',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  groupMembership: function () {
    return this.hasOne(GroupMembership, 'group_id', 'group_id').where({ user_id: this.get('user_id') })
  },

  tag: function () {
    return this.belongsTo(Tag)
  },

  user: function () {
    return this.belongsTo(User)
  }

}, HasSettings), {
  create: async function (attrs, { transacting } = {}) {
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  },

  subscribe: function (tagId, userId, groupId, isSubscribing) {
    if (isSubscribing) {
      return TagFollow.findOrCreate({ tagId, userId, groupId })
    }
    return TagFollow.remove({ tagId, userId, groupId })
  },

  findOrCreate: async function ({ tagId, topicName, userId, groupId }, { transacting } = {}) {
    if (!tagId && topicName) {
      const tag = await Tag.findOrCreate(topicName, { transacting })
      tagId = tag.id
    }
    const attrs = {
      tag_id: tagId,
      group_id: groupId,
      user_id: userId
    }
    const existing = await TagFollow.where(attrs).fetch({ transacting })
    if (existing) return existing

    const tagFollow = await TagFollow.create(attrs, { transacting })
    await bumpGroupTagFollowers(groupId, tagId, 1, transacting)
    return tagFollow
  },

  remove: async function ({ tagId, userId, groupId, transacting }) {
    const attrs = {
      tag_id: tagId,
      group_id: groupId,
      user_id: userId
    }
    const tagFollow = await TagFollow.where(attrs).fetch({ transacting })
    if (!tagFollow) return

    await tagFollow.destroy({ transacting })
    await bumpGroupTagFollowers(groupId, tagId, -1, transacting)
  },

  findFollowers: function (group_id, tag_id, limit = 3) {
    return TagFollow.query(q => {
      q.where({ group_id, tag_id })
      q.limit(limit)
    })
      .fetchAll({ withRelated: ['user', 'user.tags'] })
      .then(tagFollows => {
        return tagFollows.models.map(tf => tf.relations.user)
      })
  }
})

async function bumpGroupTagFollowers (groupId, tagId, delta, transacting) {
  const query = GroupTag.query(q => {
    q.where('group_id', groupId)
    q.where('tag_id', tagId)
  }).query()
  if (transacting) query.transacting(transacting)
  if (delta > 0) await query.increment('num_followers', delta)
  else if (delta < 0) await query.decrement('num_followers', -delta)
}
