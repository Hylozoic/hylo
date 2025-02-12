/* eslint-disable camelcase  */
import HasSettings from './mixins/HasSettings'


module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tag_follows',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  tag: function () {
    return this.belongsTo(Tag)
  },

  user: function () {
    return this.belongsTo(User)
  }

}, HasSettings), {
  create: async function (attrs, { transacting } = {}) {
    const settings = attrs.settings || { }
    return this.forge(Object.assign({ created_at: new Date() }, settings, attrs)).save({}, { transacting })
  },

  // TODO: re-evaluate what subscribing means. How does it related to chat rooms and their notification settings?
  subscribe: function (tagId, userId, groupId, isSubscribing) {
    return TagFollow.where({ group_id: groupId, tag_id: tagId, user_id: userId })
      .fetch()
      .then(tagFollow => {
        if (tagFollow) {
          return tagFollow.save({ settings: { notifications: isSubscribing ? 'all' : false } })
        } else if (!tagFollow) {
          return TagFollow.findOrCreate({ tagId, userId, groupId, isSubscribing })
        }
      })
  },

  findOrCreate: async function ({ tagId, topicName, userId, groupId, isSubscribing }, { transacting } = {}) {
    if (!tagId && topicName) {
      const tag = await Tag.findOrCreate(topicName, { transacting })
      tagId = tag.id
    }
    const attrs = {
      tag_id: tagId,
      group_id: groupId,
      user_id: userId
    }
    let tagFollow = await TagFollow.where(attrs).fetch({ transacting })
    attrs.settings = tagFollow?.settings || { }

    // If "subscribing" and there's no tag follow yet or there's an existing tag follow but they haven't "subscribed" yet
    if (isSubscribing && !attrs.settings.notifications) {
      const hasChatRoom = await ContextWidget.where({ type: 'chat', group_id: attrs.group_id, view_chat_id: attrs.tag_id }).fetch({ transacting })
      if (hasChatRoom) {
        // Default to all notifications turned on for chat rooms when initially "subscribing"
        attrs.settings.notifications = 'all'

        // Set last_read_post_id to the most recent post id so when viewing chat room for first time you start at latest post
        attrs.last_read_post_id = await Post.query(q => q.select(bookshelf.knex.raw("max(posts.id) as max"))).fetch({ transacting }).then(result => result.get('max'))
        attrs.new_post_count = 0

        await tagFollow.save(attrs, { transacting })

        // Increment the number of followers for the tag in the group
        // TODO: re-evaluate what a follower means. how does it related to chat rooms and their notification settings?
        const query = GroupTag.query(q => {
          q.where('group_id', groupId)
          q.where('tag_id', tagId)
        }).query()
        if (transacting) {
          query.transacting(transacting)
        }
        await query.increment('num_followers')
      }
    }

    if (!tagFollow) {
      tagFollow = await TagFollow.create(attrs, { transacting })
    }
    return tagFollow
  },

  remove: function ({ tagId, userId, groupId, transacting }) {
    const attrs = {
      tag_id: tagId,
      group_id: groupId,
      user_id: userId
    }
    return TagFollow.where(attrs)
      .fetch()
      .then(tagFollow => tagFollow &&
        tagFollow.destroy({ transacting })
          .then(() => {
            const query = GroupTag.query(q => {
              q.where('group_id', attrs.group_id)
              q.where('tag_id', attrs.tag_id)
            }).query()
            if (transacting) {
              query.transacting(transacting)
            }
            return query.decrement('num_followers')
          })
      )
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
