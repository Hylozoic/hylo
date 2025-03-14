import { gql } from 'urql'
import { find, pick } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { openURL } from 'hooks/useOpenURL'

export const ACTION_ANNOUNCEMENT = 'announcement'
export const ACTION_APPROVED_JOIN_REQUEST = 'approvedJoinRequest'
export const ACTION_COMMENT_MENTION = 'commentMention'
export const ACTION_DONATION_TO = 'donation to'
export const ACTION_DONATION_FROM = 'donation from'
export const ACTION_EVENT_INVITATION = 'eventInvitation'
export const ACTION_GROUP_CHILD_GROUP_INVITE = 'groupChildGroupInvite'
export const ACTION_GROUP_CHILD_GROUP_INVITE_ACCEPTED = 'groupChildGroupInviteAccepted'
export const ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST = 'groupParentGroupJoinRequest'
export const ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST_ACCEPTED = 'groupParentGroupJoinRequestAccepted'
export const ACTION_JOIN_REQUEST = 'joinRequest'
export const ACTION_MENTION = 'mention'
export const ACTION_NEW_POST = 'newPost'
export const ACTION_NEW_COMMENT = 'newComment'
export const ACTION_TAG = 'tag'
export const NOTIFICATIONS_WHITELIST = [
  ACTION_NEW_COMMENT,
  ACTION_TAG,
  ACTION_JOIN_REQUEST,
  ACTION_APPROVED_JOIN_REQUEST,
  ACTION_MENTION,
  ACTION_COMMENT_MENTION,
  ACTION_ANNOUNCEMENT,
  ACTION_NEW_POST
]

export const NOTIFICATION_TEXT_MAX = 76

export const markActivityReadMutation = gql`
  mutation ($id: ID) {
    markActivityRead(id: $id) {
      id
      unread
    }
  }
`

export const markAllActivitiesReadMutation = gql`
  mutation {
    markAllActivitiesRead {
      success
    }
  }
`

export const truncateHTML = html => TextHelpers.presentHTMLToText(html, { truncate: NOTIFICATION_TEXT_MAX }).replace(/\n/g, ' ')

export const truncateText = text => TextHelpers.truncateText(text, NOTIFICATION_TEXT_MAX)

export function refineActivity ({ action, actor, comment, group, post, meta }) {
  switch (action) {
    case ACTION_COMMENT_MENTION:
      return {
        body: `wrote: ${truncateHTML(comment.text)}`,
        header: 'mentioned you in a comment on',
        nameInHeader: true,
        title: post.title,
        onPress: () => openURL(`/post/${post.id}`)
      }

    case ACTION_NEW_COMMENT:
      return {
        body: `wrote: "${truncateHTML(comment.text)}"`,
        header: 'New Comment on',
        title: post.title,
        onPress: () => openURL(`/post/${post.id}`)
      }

    case ACTION_MENTION:
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'mentioned you',
        nameInHeader: true,
        onPress: () => openURL(`/post/${post.id}`)
      }

    case ACTION_TAG: {
      const topicReason = find(r => r.startsWith('tag: '), meta.reasons)
      const topic = topicReason.split(': ')[1]
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'New Post in',
        objectName: topic,
        onPress: () => openURL(`/post/${post.id}/chat/${topic}?postId=${post.id}`)
      }
    }

    case ACTION_NEW_POST: {
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'New Post in',
        objectName: group.name,
        onPress: () => openURL(`/post/${post.id}`)
      }
    }

    case ACTION_JOIN_REQUEST:
      return {
        body: 'asked to join',
        group: group.name,
        header: 'New join request',
        nameInHeader: true,
        onPress: () => openURL(`/groups/${group?.slug}/settings/requests`)
      }

    case ACTION_APPROVED_JOIN_REQUEST:
      return {
        body: 'approved your request to join',
        group: group.name,
        header: 'Join Request Approved',
        onPress: () => openURL(`/groups/${group?.slug}/stream`)
      }
    case ACTION_ANNOUNCEMENT:
      return {
        body: `wrote: "${truncateText(post.title)}"`,
        header: 'posted an announcement',
        nameInHeader: true,
        onPress: () => openURL(`/post/${post.id}/edit`),
      }
  }
}

export function refineNotification () {
  return ({ activity, createdAt, id }, i, notifications) => {
    const { actor, meta, unread } = activity
    // Only show separator between read and unread notifications

    const avatarSeparator = i !== notifications.length - 1
      ? unread !== notifications[i + 1].activity.unread
      : false

    return {
      id,
      activityId: activity.id,
      actor: pick(['avatarUrl', 'name'], actor),
      avatarSeparator,
      createdAt: TextHelpers.humanDate(createdAt),
      ...refineActivity(activity),
      unread,
      reasons: meta.reasons
    }
  }
}

export const refineNotifications = (notifications) => {
  if (!notifications) return []

  return notifications
    .map(refineNotification())
    .filter(n => n.reasons.every(r => reasonInWhitelist(r, NOTIFICATIONS_WHITELIST)))
}

export function reasonInWhitelist (reason, whitelist) {
  const reasonSubstring = reason.indexOf(':') === -1 ? reason : reason.substring(0, reason.indexOf(':'))
  const response = whitelist.indexOf(reasonSubstring) !== -1
  return response
}
