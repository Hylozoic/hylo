/* eslint-disable camelcase */
import { URL } from 'url'
import { compact, some, sum, uniq } from 'lodash/fp'
import { DateTimeHelpers, TextHelpers } from '@hylo/shared'
import { mapLocaleToSendWithUS } from '../../../lib/util'
import RedisClient from '../../services/RedisClient'
import { en } from '../../../lib/i18n/en'
import { es } from '../../../lib/i18n/es'
const locales = { en, es }
const MAX_PUSH_NOTIFICATION_LENGTH = 140

export async function notifyAboutMessage ({ commentId }) {
  const comment = await Comment.find(commentId, { withRelated: ['media'] })
  const post = await Post.find(comment.get('post_id'))
  const followers = await post.followers().fetch()

  const { user_id, post_id } = comment.attributes
  const recipients = followers.filter(u => u.id !== user_id)
  const user = followers.find(u => u.id === user_id)
  const alert = comment.relations.media.length !== 0
    ? `${user.get('name')} sent an image`
    : `${user.get('name')}: ${TextHelpers.presentHTMLToText(comment.text(), { truncate: MAX_PUSH_NOTIFICATION_LENGTH })}`
  const path = new URL(Frontend.Route.thread({ id: post_id })).pathname

  return Promise.map(recipients, async user => {
    // don't notify if the user has read the thread recently and respect the
    // dm_notifications setting.
    if (!(await user.enabledNotification(Notification.TYPE.Message, Notification.MEDIUM.Push))) return

    const lastReadAt = user.pivot.get('last_read_at')

    if (!lastReadAt || comment.get('created_at') > new Date(lastReadAt)) {
      return user.sendPushNotification(alert, path)
    }
  })
}

export const sendDigests = async () => {
  const redisClient = RedisClient.create()
  const now = new Date()
  const fallbackTime = () => new Date(now - 10 * 60000)

  let lastDigestAt = await redisClient.get(sendDigests.REDIS_TIMESTAMP_KEY)

  lastDigestAt = lastDigestAt ? new Date(Number(lastDigestAt)) : fallbackTime()

  const posts = await Post.query(q => {
    q.where('updated_at', '>', lastDigestAt)
    q.where('active', true)
  }).fetchAll({
    withRelated: [
      {
        comments: q => {
          q.where('created_at', '>', lastDigestAt)
          q.orderBy('created_at', 'asc')
        }
      },
      'user',
      'groups',
      'comments.user',
      'comments.media'
    ]
  })

  const numSends = await Promise.all(posts.map(async post => {
    const { comments } = post.relations
    if (comments.length === 0) return []

    const firstGroup = post.relations.groups.first()

    const followers = await post.followers().fetch()

    return Promise.map(followers.models, async user => {
      // select comments not written by this user and newer than user's last
      // read time.
      let lastReadAt = user.pivot.get('last_read_at')
      if (lastReadAt) lastReadAt = new Date(lastReadAt)
      const locale = mapLocaleToSendWithUS(user.get('settings')?.locale || 'en-US')

      const filtered = comments.filter(c =>
        c.get('created_at') > (lastReadAt || 0) &&
        c.get('user_id') !== user.id)

      if (filtered.length === 0) return

      const presentComment = comment => {
        const presented = {
          id: comment.id,
          text: comment.text(),
          image: comment.relations?.media?.first?.()?.pick('url', 'thumbnail_url'),
          name: comment.relations.user.get('name'),
          avatar_url: comment.relations.user.get('avatar_url'),
          timestamp: comment.get('created_at').toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
        }
        return presented
      }

      if (post.get('type') === Post.Type.THREAD) {
        if (!(await user.enabledNotification(Notification.TYPE.Message, Notification.MEDIUM.Email))) return

        const others = filtered.map(comment => comment.relations.user)

        const otherNames = uniq(others.map(other => other.get('name')))

        const otherAvatarUrls = others.map(other => other.get('avatar_url'))

        const participantNames = otherNames.length === 1
          ? otherNames[0]
          : otherNames.slice(0, otherNames.length - 1).join(', ') + ' & ' + otherNames[otherNames.length - 1]

        const clickthroughParams = '?' + new URLSearchParams({
          ctt: 'message_digest_email',
          cti: user.id
        }).toString()

        return Email.sendMessageDigest({
          email: user.get('email'),
          locale,
          data: {
            count: filtered.length,
            date: DateTimeHelpers.formatDatePair({ start: filtered[0].get('created_at') }),
            email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
            participant_avatars: otherAvatarUrls[0],
            participant_names: participantNames,
            other_names: otherNames,
            thread_url: Frontend.Route.thread(post) + clickthroughParams,
            messages: filtered.map(presentComment)
          },
          sender: {
            reply_to: Email.postReplyAddress(post.id, user.id)
          }
        })
      } else {
        if (!(await user.enabledNotification(Notification.TYPE.Comment, Notification.MEDIUM.Email))) return

        const commentData = filtered.map(presentComment)
        const hasMention = ({ text }) =>
          RichText.getUserMentions(text).includes(user.id)

        const clickthroughParams = '?' + new URLSearchParams({
          ctt: 'comment_digest_email',
          cti: user.id,
          ctcn: firstGroup?.get('name')
        }).toString()

        return Email.sendCommentDigest({
          email: user.get('email'),
          locale,
          data: {
            count: commentData.length,
            date: DateTimeHelpers.formatDatePair({ start: filtered[0].get('created_at'), timezone: post.get('timezone') }),
            email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
            post_title: post.summary(),
            post_creator_avatar_url: post.relations.user.get('avatar_url') + clickthroughParams,
            thread_url: Frontend.Route.comment({ comment: filtered[0], group: firstGroup, post }) + clickthroughParams,
            comments: commentData,
            subject_prefix: some(hasMention, commentData)
              ? 'You were mentioned in'
              : 'New comments on'
          },
          sender: {
            reply_to: Email.postReplyAddress(post.id, user.id),
            name: firstGroup ? `${firstGroup.get('name')} (via Hylo)` : locales[locale].theTeamAtHylo
          }
        })
      }
    })
      .then(sends => compact(sends).length)
  }))

  await redisClient.set(sendDigests.REDIS_TIMESTAMP_KEY, now.getTime().toString())
  return sum(numSends)
}

// we keep track of the last time we sent comment digests in Redis, so that the
// next time we send them, we can exclude any comments that were created before
// the last send.
sendDigests.REDIS_TIMESTAMP_KEY = 'Comment.sendDigests.lastSentAt'
