/* global bookshelf, GroupView, User, GroupMembership, Post, Email, Frontend, RichText, sails */
/* eslint-disable camelcase */

import RedisClient from '../services/RedisClient'
import { normalizeLocaleToFull } from '../../lib/localeHelpers'
import { ensureGroupParent, groupDisplayNameWithParent, senderNameViaHylo } from '../../lib/email/senderNameViaHylo'
import { UNSUBSCRIBE_SCOPE, keepsOnlyDirect, unsubscribeScopeOf } from './notification/rules/unsubscribeScope'
import { isInactive } from './notification/rules/inactiveReader'

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
  // Also bumps updated_at so hourly chat digest can see the room as recently active.
  incrementNewPostCount: async function (viewId, userIds, { transacting } = {}) {
    if (!userIds || userIds.length === 0) return

    const ids = userIds.map(id => Number(id)).filter(id => Number.isFinite(id))
    if (ids.length === 0) return

    const now = new Date()
    const query = bookshelf.knex.raw(`
      INSERT INTO group_views_users (view_id, user_id, new_post_count, created_at, updated_at)
      SELECT ?, u.id, 1, ?, ?
      FROM unnest(?::bigint[]) AS u(id)
      ON CONFLICT (view_id, user_id) DO UPDATE SET
        new_post_count = group_views_users.new_post_count + 1,
        updated_at = EXCLUDED.updated_at
    `, [viewId, now, now, ids])
    await (transacting ? query.transacting(transacting) : query)
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
   * Label for the hourly chat digest: the group name, or "Parent > Space" for spaces.
   */
  chatRoomDisplayName: function (group) {
    return groupDisplayNameWithParent(group) || 'chat'
  },

  /**
   * Avatar URL for the chat digest pill. Spaces usually have a Lucide icon, not
   * an avatar image — fall back to the parent group's avatar so the pill still
   * shows the group icon.
   */
  chatRoomAvatarUrl: function (group) {
    if (!group) return null
    const own = group.get('avatar_url')
    if (own) return own
    if (group.get('type') !== 'space') return null
    const parent = group.relations?.parentGroup ||
      (typeof group.related === 'function' ? group.related('parentGroup') : null)
    return (parent && typeof parent.get === 'function' ? parent.get('avatar_url') : null) || null
  },

  /**
   * Ensure a space has its parent group attached for chatRoomDisplayName / URLs.
   * Nested withRelated on the self-referential Group.parentGroup often comes back empty.
   */
  ensureParentGroup: async function (group) {
    return ensureGroupParent(group)
  },

  /**
   * Spaces have no channel settings of their own in the UI, so a space membership
   * follows the parent group membership's sendEmail when there is one.
   */
  emailEnabledFor: async function (membership, group) {
    if (group.get('type') === 'space' && group.get('parent_id')) {
      const parentMembership = await GroupMembership.forPair(membership.get('user_id'), group.get('parent_id')).fetch()
      if (parentMembership) return !!parentMembership.getSetting('sendEmail')
    }
    return !!membership.getSetting('sendEmail')
  },

  /**
   * The email digest setting that governs a chat room's digest. Spaces have no digest
   * setting of their own, so a space membership follows the parent group membership.
   */
  digestFrequencyFor: async function (membership, group) {
    if (group.get('type') === 'space' && group.get('parent_id')) {
      const parentMembership = await GroupMembership.forPair(membership.get('user_id'), group.get('parent_id')).fetch()
      if (parentMembership) return parentMembership.getSetting('digestFrequency')
    }
    return membership.getSetting('digestFrequency')
  },

  /**
   * Hourly email digests for chat views with unread chat posts.
   * Sends one email per chat view (parent group chat and each space chat).
   * Uses membership postNotifications: all = every chat, important = mentions
   * (and announcements), none = skip digest. An email digest set to Never stops the
   * chat digest too (D72). Under 'everything except direct' (D35), and for members
   * away 30 days or more (D9), only chats that mention the person are sent.
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
        // incrementNewPostCount bumps this timestamp; group_views.updated_at
        // only changes when the view itself is edited, so it is not a chat signal.
        q.where('group_views_users.updated_at', '>', lastSentAt)
        q.select('group_views_users.*')
      }).fetchAll({
        withRelated: ['user', 'view', 'view.group', 'view.group.parentGroup']
      })

      sails.log.info(`GroupViewUser.sendDigests: checking ${chatViewUsers.length} chat views updated since ${lastSentAt.toISOString()}`)

      for (const viewUser of chatViewUsers.models) {
        try {
          const user = viewUser.relations.user
          const view = viewUser.relations.view
          const group = view?.relations?.group
          if (!user || !view || !group) continue

          await GroupViewUser.ensureParentGroup(group)

          const userId = viewUser.get('user_id')
          const groupId = view.get('group_id')

          if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true' && !(await User.isTester(userId))) continue

          const membership = await GroupMembership.forPair(userId, groupId).fetch()
          if (!membership || !membership.get('active')) continue
          if (!(await GroupViewUser.emailEnabledFor(membership, group))) continue
          if ((await GroupViewUser.digestFrequencyFor(membership, group)) === 'never') continue

          const postNotifications = membership.getSetting('postNotifications')
          if (postNotifications !== 'all' && postNotifications !== 'important') continue

          // 'Everything except direct' keeps only chats that mention them (D35), and so
          // does being away 30 days or more: mentions still reach them (D9)
          const scope = unsubscribeScopeOf(user)
          if (scope === UNSUBSCRIBE_SCOPE.EVERYTHING) continue
          const mentionsOnly = keepsOnlyDirect(scope) || isInactive(user)

          const settings = Object.assign({}, viewUser.get('settings') || {})
          const lastReadPostId = Number(viewUser.get('last_read_post_id')) || 0
          const lastDigestPostId = Number(settings.lastChatDigestPostId) || 0
          const afterPostId = Math.max(lastReadPostId, lastDigestPostId)
          // Per-room watermark, not the global lastSentAt. A shared timestamp
          // made the second room's chats look already-sent after the first room emailed.
          const posts = await Post.query(q => {
            q.join('groups_posts', 'posts.id', 'groups_posts.post_id')
            q.where('posts.created_at', '>', oneDayAgo)
            q.where('posts.id', '>', afterPostId)
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

          if (mentionsOnly) {
            postData = postData.filter(p => p.mentionedMe)
            if (postData.length === 0) continue
          } else if (postNotifications === 'important') {
            postData = postData.filter(p => p.mentionedMe || p.announcement)
            if (postData.length === 0) continue
          }

          if (!user.get('email')) continue

          const locale = normalizeLocaleToFull(user.get('settings')?.locale || 'en-US')
          const chatRoomName = GroupViewUser.chatRoomDisplayName(group)
          const clickthroughParams = '?' + new URLSearchParams({
            ctt: 'chat_digest_email',
            cti: user.id,
            ctcn: chatRoomName
          }).toString()

          const result = await Email.sendChatDigest({
            email: user.get('email'),
            locale,
            version: 'Spaces',
            sender: {
              name: senderNameViaHylo(chatRoomName, locale),
              reply_to: 'DoNotReply@hylo.com'
            },
            data: {
              count: postData.length,
              chat_room_name: chatRoomName,
              chat_room_url: Frontend.appendQueryString(
                Frontend.Route.chat(group),
                clickthroughParams
              ),
              email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
              group_name: chatRoomName,
              group_avatar_url: Frontend.appendQueryString(
                GroupViewUser.chatRoomAvatarUrl(group),
                clickthroughParams
              ),
              posts: postData
            },
            // One-click unsubscribe sets this group's email digest to Never, which stops
            // its chat digests too (D34, D72); a space's goes to its parent group
            unsubscribe: { groupId: group.id }
          })
          if (result !== false) {
            const maxPostId = posts.models.reduce(
              (maxId, post) => Math.max(maxId, Number(post.id)),
              lastDigestPostId
            )
            await viewUser.save({
              settings: Object.assign({}, settings, { lastChatDigestPostId: maxPostId })
            }, { patch: true })
            numSent += 1
            sails.log.info(`GroupViewUser.sendDigests: sent ${chatRoomName} to user ${userId}`)
          }
        } catch (err) {
          sails.log.error(
            `GroupViewUser.sendDigests: error sending digest for group_views_users ${viewUser.id} (view ${viewUser.get('view_id')}, user ${viewUser.get('user_id')}): ${err.message}`,
            err.stack
          )
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
