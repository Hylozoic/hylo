/* global bookshelf, GroupView, User, GroupMembership, Post, Email, Frontend, RichText, sails */
/* eslint-disable camelcase */

const RedisClient = require('../services/RedisClient')
const { normalizeLocaleToFull } = require('../../lib/localeHelpers')
const { senderNameViaHylo } = require('../../lib/email/senderNameViaHylo')

// See docs/spaces-and-views-engineering-spec.md section 2.6 / 3.2

const CHAT_DIGEST_REDIS_TIMESTAMP_KEY = 'ChatRoom.digests.lastSentAt'

module.exports = bookshelf.Model.extend({
  tableName: 'group_views_users',
  requireFetch: false,
  hasTimestamps: true,

  view () {
    return this.belongsTo(GroupView, 'view_id')
  },

  user () {
    return this.belongsTo(User, 'user_id')
  }

}, {
  findOrCreate: async function (viewId, userId, { transacting } = {}) {
    let viewUser = await GroupViewUser.where({ view_id: viewId, user_id: userId }).fetch({ transacting })
    if (!viewUser) {
      const now = new Date()
      viewUser = await GroupViewUser.forge({
        view_id: viewId,
        user_id: userId,
        new_post_count: 0,
        created_at: now,
        updated_at: now
      }).save(null, { transacting, method: 'insert' })
    }
    return viewUser
  },

  // Mark a view read for the author up to the post they just created.
  markAuthorRead: async function (viewId, userId, postId, { transacting } = {}) {
    if (!viewId || !userId || !postId) return

    const viewUser = await GroupViewUser.findOrCreate(viewId, userId, { transacting })
    return viewUser.save({
      last_read_post_id: postId,
      new_post_count: 0,
      updated_at: new Date()
    }, { transacting, patch: true })
  },

  // Zero new_post_count and advance last_read to the latest post in the group.
  // Frontend treats that as "seen everything" regardless of view type.
  markRead: async function (viewId, userId, { transacting } = {}) {
    const viewUser = await GroupViewUser.findOrCreate(viewId, userId, { transacting })
    const view = await GroupView.where({ id: viewId }).fetch({ transacting })

    const lastPost = await bookshelf.knex('groups_posts')
      .max('post_id as max')
      .where({ group_id: view.get('group_id') })
      .modify(q => { if (transacting) q.transacting(transacting) })
      .then(rows => rows[0]?.max)

    return viewUser.save({
      new_post_count: 0,
      last_read_post_id: lastPost || viewUser.get('last_read_post_id'),
      updated_at: new Date()
    }, { transacting, patch: true })
  },

  // Increment new_post_count for every given user's row for a view. Rows are
  // created on demand for users who don't have one yet (e.g. legacy members).
  incrementNewPostCount: async function (viewId, userIds, { transacting } = {}) {
    if (!userIds || userIds.length === 0) return

    for (const userId of userIds) {
      await GroupViewUser.findOrCreate(viewId, userId, { transacting })
    }

    await bookshelf.knex('group_views_users')
      .where('view_id', viewId)
      .whereIn('user_id', userIds)
      .increment('new_post_count', 1)
      .modify(q => { if (transacting) q.transacting(transacting) })
  },

  // Decrement new_post_count for users who had not yet read past this post.
  decrementNewPostCount: async function (viewId, { beforePostId, transacting } = {}) {
    if (!viewId) return

    await bookshelf.knex('group_views_users')
      .where('view_id', viewId)
      .where('new_post_count', '>', 0)
      .modify(q => {
        if (beforePostId != null) {
          q.where(function () {
            this.whereNull('last_read_post_id').orWhere('last_read_post_id', '<', beforePostId)
          })
        }
        if (transacting) q.transacting(transacting)
      })
      .decrement('new_post_count', 1)
  },

  /**
   * Hourly email digests for chat views with unread chat posts.
   * Uses membership postNotifications: all = every chat, important = mentions
   * (and announcements), none = skip digest.
   */
  sendDigests: async function () {
    const redisClient = RedisClient.create()
    let lastSentAt = await redisClient.get(CHAT_DIGEST_REDIS_TIMESTAMP_KEY)
    if (lastSentAt) lastSentAt = new Date(parseInt(lastSentAt))
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    if (!lastSentAt || lastSentAt < oneDayAgo) {
      // Cap catch-up window so a missed run does not spam days of backlog.
      lastSentAt = oneDayAgo
    }

    let numSent = 0

    try {
      const chatViewUsers = await GroupViewUser.query(q => {
        q.join('group_views', 'group_views.id', 'group_views_users.view_id')
        q.where('group_views.type', GroupView.Type.CHAT)
        q.where('group_views_users.new_post_count', '>', 0)
        q.where('group_views_users.updated_at', '>', lastSentAt)
        q.select('group_views_users.*')
      }).fetchAll({
        withRelated: ['user', 'view', 'view.group']
      })

      sails.log.info(`GroupViewUser.sendDigests: checking ${chatViewUsers.length} chat views updated since ${lastSentAt.toISOString()}`)

      for (const viewUser of chatViewUsers) {
        try {
          const user = viewUser.relations.user
          const view = viewUser.relations.view
          const group = view?.relations?.group
          if (!user || !view || !group) continue

          const userId = viewUser.get('user_id')
          const groupId = view.get('group_id')

          if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true' && !(await User.isTester(userId))) continue

          const membership = await GroupMembership.forPair(userId, groupId).fetch()
          if (!membership || !membership.get('active') || !membership.getSetting('sendEmail')) continue

          const postNotifications = membership.getSetting('postNotifications')
          if (postNotifications !== 'all' && postNotifications !== 'important') continue

          const lastReadPostId = viewUser.get('last_read_post_id') || 0
          const posts = await Post.query(q => {
            q.join('groups_posts', 'posts.id', 'groups_posts.post_id')
            q.where('posts.created_at', '>', lastSentAt)
            q.where('posts.id', '>', lastReadPostId)
            q.where('posts.type', Post.Type.CHAT)
            q.where('posts.active', true)
            q.where('groups_posts.group_id', groupId)
          }).fetchAll({
            withRelated: ['user', 'media', 'tags']
          })

          if (posts.length === 0 || posts.every(p => p.relations.user.id === userId)) {
            continue
          }

          let postData = posts.map(post => {
            const mentions = RichText.getUserMentions(post.details())
            const mentionedMe = mentions.includes(userId)
            return {
              id: post.id,
              announcement: post.get('announcement'),
              content: post.details(),
              creator_name: post.relations.user.get('name'),
              creator_avatar_url: post.relations.user.get('avatar_url'),
              images: post.relations.media.filter(m => m.get('type') === 'image').map(m => m.pick('url', 'thumbnail_url')),
              mentionedMe,
              post_url: Frontend.Route.post(post, group),
              timestamp: post.get('created_at').toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: post.get('timezone') || 'UTC' })
            }
          })

          if (postNotifications === 'important') {
            postData = postData.filter(p => p.mentionedMe || p.announcement)
            if (postData.length === 0) continue
          }

          if (!user.get('email')) continue

          const locale = normalizeLocaleToFull(user.get('settings')?.locale || 'en-US')
          const clickthroughParams = '?' + new URLSearchParams({
            ctt: 'chat_digest_email',
            cti: user.id,
            ctcn: group.get('name')
          }).toString()

          const result = await Email.sendChatDigest({
            email: user.get('email'),
            locale,
            sender: {
              name: senderNameViaHylo(group.get('name'), locale),
              reply_to: 'DoNotReply@hylo.com'
            },
            data: {
              count: postData.length,
              chat_topic: view.get('name') || group.get('name') || 'chat',
              chat_room_url: Frontend.appendQueryString(
                Frontend.Route.post(posts.models[posts.models.length - 1], group),
                clickthroughParams
              ),
              email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
              group_name: group.get('name'),
              group_avatar_url: Frontend.appendQueryString(group.get('avatar_url'), clickthroughParams),
              posts: postData
            }
          })
          if (result) numSent += 1
        } catch (err) {
          sails.log.error(
            `GroupViewUser.sendDigests: error sending digest for group_views_users ${viewUser.id} (view ${viewUser.get('view_id')}, user ${viewUser.get('user_id')}): ${err.message}`,
            err.stack
          )
          throw err
        }
      }

      await redisClient.set(CHAT_DIGEST_REDIS_TIMESTAMP_KEY, now.getTime().toString())
      sails.log.info(`GroupViewUser.sendDigests: sent ${numSent} chat digests, updated last sent timestamp to ${now.toISOString()}`)
      return numSent
    } catch (err) {
      sails.log.error(
        `GroupViewUser.sendDigests: run failed before updating last sent timestamp (lastSentAt=${lastSentAt.toISOString()}), digests will be re-sent next run: ${err.message}`,
        err.stack
      )
      throw err
    }
  }
})
