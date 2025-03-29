/* eslint-disable camelcase  */
import HasSettings from './mixins/HasSettings'
import RedisClient from '../services/RedisClient'
import { mapLocaleToSendWithUS } from '../../lib/util'
// import { DateTimeHelpers } from '@hylo/shared'

const CHAT_ROOM_DIGEST_REDIS_TIMESTAMP_KEY = 'ChatRoom.digests.lastSentAt'

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
    attrs.settings = attrs.settings || { }
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
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
    attrs.settings = tagFollow?.get('settings') || { }
    let hasChanged = false

    // If "subscribing" and there's no tag follow yet or there's an existing tag follow but they haven't "subscribed" yet
    if (isSubscribing && !attrs.settings.notifications) {
      const hasChatRoom = await ContextWidget.where({ type: 'chat', group_id: attrs.group_id, view_chat_id: attrs.tag_id }).fetch({ transacting })
      if (hasChatRoom) {
        // Default to all notifications turned on for chat rooms when initially "subscribing"
        attrs.settings.notifications = 'all'

        // Set last_read_post_id to the most recent post id so when viewing chat room for first time you start at latest post
        attrs.last_read_post_id = await Post.query(q => q.select(bookshelf.knex.raw('max(posts.id) as max'))).fetch({ transacting }).then(result => result.get('max'))
        attrs.new_post_count = 0
        hasChanged = true

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
    } else if (hasChanged) {
      await tagFollow.save(attrs, { transacting })
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
  },

  sendDigests: async function () {
    const redisClient = RedisClient.create()
    let lastSentAt = await redisClient.get(CHAT_ROOM_DIGEST_REDIS_TIMESTAMP_KEY)
    if (lastSentAt) lastSentAt = new Date(parseInt(lastSentAt))
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    if (!lastSentAt || lastSentAt < oneDayAgo) {
      // If for some reason (e.g. server error) the digest was not sent in the last 24 hours only send the digests for chat rooms with posts in the last 24 hours
      // To prevent spamming the users with digests and overloading the server
      lastSentAt = oneDayAgo
    }

    let numSent = 0

    const tagFollowsWithNewPosts = await TagFollow.query(q => {
      q.where('new_post_count', '>', 0)
      q.where('updated_at', '>', lastSentAt) // TODO: This is helpful to filter out ones that don't have any new posts since the last sent time, but also updated_at could be set for reasons other than a new post. Maybe we store the timestamp of the latest post in the tag follow as an extra optimization?
      q.whereRaw("(settings->>'notifications' = 'all' OR settings->>'notifications' = 'important')")
    }).fetchAll({
      withRelated: ['tag', 'user', 'group']
    })

    for (const tagFollow of tagFollowsWithNewPosts) {
      // TODO: check global notification setting once we have it if (!tagFollow.relations.user.enabledNotification(Notification.MEDIUM.Email)) return
      const groupMembership = await tagFollow.groupMembership().fetch()
      if (!groupMembership || !groupMembership.get('active') || !groupMembership.getSetting('sendEmail')) continue

      const posts = await Post.query(q => {
        q.join('posts_tags', 'posts.id', 'posts_tags.post_id')
        q.join('groups_posts', 'posts.id', 'groups_posts.post_id')
        q.where('posts.created_at', '>', lastSentAt)
        q.where('posts.id', '>', tagFollow.get('last_read_post_id'))
        q.where('posts.type', 'chat')
        q.where('posts.active', true)
        q.where('groups_posts.group_id', tagFollow.get('group_id'))
        q.where('posts_tags.tag_id', tagFollow.get('tag_id'))
      }).fetchAll({
        withRelated: ['user', 'media', 'tags']
      })

      // If there are no new posts since last digest created by someone other than the tag follow user, then continue to the next tagFollow
      if (posts.length === 0 || posts.every(p => p.relations.user.id === tagFollow.get('user_id'))) {
        continue
      }

      let postData = posts.map(post => {
        const mentions = RichText.getUserMentions(post.details())
        const mentionedMe = mentions.includes(tagFollow.get('user_id'))
        return {
          id: post.id,
          announcement: post.get('announcement'),
          content: post.details(),
          creator_name: post.relations.user.get('name'),
          creator_avatar_url: post.relations.user.get('avatar_url'),
          images: post.relations.media.filter(m => m.get('type') === 'image').map(m => m.pick('url', 'thumbnail_url')),
          mentionedMe,
          post_url: Frontend.Route.post(post, tagFollow.relations.group),
          timestamp: post.get('created_at').toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
        }
      })

      if (tagFollow.get('settings').notifications === 'important') {
        postData = postData.filter(p => p.mentionedMe || p.announcement)
        if (postData.length === 0) {
          continue
        }
      }

      if (!tagFollow.relations.user?.get('email')) continue

      const locale = mapLocaleToSendWithUS(tagFollow.relations.user?.get('settings')?.locale || 'en-US')
      const result = await Email.sendChatDigest({
        version: 'Redesign 2025',
        email: tagFollow.relations.user.get('email'),
        locale,
        data: {
          count: postData.length,
          chat_topic: tagFollow.relations.tag.get('name'),
          // For the overall chat room URL use the URL of the last post in the email digest
          chat_room_url: Frontend.Route.post(posts.models[posts.models.length - 1], tagFollow.relations.group),
          // date: DateTimeHelpers.formatDatePair(posts[0].get('created_at'), false, false, posts[0].get('timezone')),
          group_name: tagFollow.relations.group.get('name'),
          group_avatar_url: tagFollow.relations.group.get('avatar_url'),
          posts: postData
        }
      })
      if (result) {
        numSent = numSent + 1
      }
    }
    await redisClient.set(CHAT_ROOM_DIGEST_REDIS_TIMESTAMP_KEY, now.getTime().toString())
    return numSent
  }
})
