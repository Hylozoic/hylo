import { gql } from 'urql'
import { find, pick } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { openURL } from 'hooks/useOpenURL'
import { personUrl, chatUrl, groupUrl } from '@hylo/navigation'

export const ACTION_ANNOUNCEMENT = 'announcement'
export const ACTION_APPROVED_JOIN_REQUEST = 'approvedJoinRequest'
export const ACTION_CHAT = 'chat'
export const ACTION_COMMENT_MENTION = 'commentMention'
export const ACTION_DONATION_TO = 'donation to'
export const ACTION_DONATION_FROM = 'donation from'
export const ACTION_EVENT_INVITATION = 'eventInvitation'
export const ACTION_GROUP_CHILD_GROUP_INVITE = 'groupChildGroupInvite'
export const ACTION_GROUP_CHILD_GROUP_INVITE_ACCEPTED = 'groupChildGroupInviteAccepted'
export const ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST = 'groupParentGroupJoinRequest'
export const ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST_ACCEPTED = 'groupParentGroupJoinRequestAccepted'
export const ACTION_GROUP_PEER_GROUP_INVITE = 'groupPeerGroupInvite'
export const ACTION_GROUP_PEER_GROUP_INVITE_ACCEPTED = 'groupPeerGroupInviteAccepted'
export const ACTION_JOIN_REQUEST = 'joinRequest'
export const ACTION_MEMBER_JOINED_GROUP = 'memberJoinedGroup'
export const ACTION_MENTION = 'mention'
export const ACTION_NEW_POST = 'newPost'
export const ACTION_NEW_COMMENT = 'newComment'
export const ACTION_TAG = 'tag'
export const ACTION_TRACK_COMPLETED = 'trackCompleted'
export const ACTION_TRACK_ENROLLMENT = 'trackEnrollment'
export const NOTIFICATIONS_WHITELIST = [
  ACTION_CHAT,
  ACTION_NEW_COMMENT,
  ACTION_TAG,
  ACTION_JOIN_REQUEST,
  ACTION_APPROVED_JOIN_REQUEST,
  ACTION_MEMBER_JOINED_GROUP,
  ACTION_MENTION,
  ACTION_COMMENT_MENTION,
  ACTION_ANNOUNCEMENT,
  ACTION_NEW_POST,
  ACTION_TRACK_COMPLETED,
  ACTION_TRACK_ENROLLMENT,
  ACTION_GROUP_CHILD_GROUP_INVITE,
  ACTION_GROUP_CHILD_GROUP_INVITE_ACCEPTED,
  ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST,
  ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST_ACCEPTED,
  ACTION_GROUP_PEER_GROUP_INVITE,
  ACTION_GROUP_PEER_GROUP_INVITE_ACCEPTED
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

export function refineActivity ({ action, actor, comment, group, post, track, meta, otherGroup }, t) {
  // Debug logging for notification data
  if (__DEV__ && (
      // action === ACTION_GROUP_PEER_GROUP_INVITE ||
      // action === ACTION_GROUP_PEER_GROUP_INVITE_ACCEPTED ||
      action === ACTION_CHAT
    )) {
    console.log('🔍 Mobile Notification Data Debug:', {
      action,
      actor: actor ? { id: actor.id, name: actor.name } : 'undefined',
      group: group ? { id: group.id, name: group.name, slug: group.slug } : 'undefined',
      otherGroup: otherGroup ? { id: otherGroup.id, name: otherGroup.name, slug: otherGroup.slug } : 'undefined',
      meta: meta ? meta.reasons : 'undefined'
    })
  }

  switch (action) {
    case ACTION_CHAT: {
      const topicReason = find(r => r.startsWith('chat: '), meta.reasons)
      const topic = topicReason.split(': ')[1]
      return {
        body: `${t('wrote:')} "${truncateHTML(post.details)}"`,
        header: t('New Chat')+':',
        objectName: group.name,
        onPress: () => openURL(chatUrl(topic, { context: 'group', groupSlug: group?.slug }) + `?postId=${post.id}`)
      }
    }

    case ACTION_COMMENT_MENTION:
      return {
        body: `${t('wrote:')} ${truncateHTML(comment.text)}`,
        header: t('mentioned you in a comment on'),
        nameInHeader: true,
        title: post.title,
        onPress: () => openURL(`/groups/${group?.slug}/post/${post.id}`)
      }

    case ACTION_NEW_COMMENT:
      return {
        body: `${t('wrote:')} "${truncateHTML(comment.text)}"`,
        header: t('New Comment on'),
        title: post.title,
        onPress: () => openURL(`/groups/${group?.slug}/post/${post.id}`)
      }

    case ACTION_MEMBER_JOINED_GROUP:
      return {
        body: t('{{name}} joined your group', { name: actor.name }),
        header: t('New Member joined {{groupName}}', { groupName: group.name }),
        onPress: () => openURL(personUrl(actor.id, group.slug))
      }

    case ACTION_MENTION:
      return {
        body: `${t('wrote:')} "${truncateHTML(post.details)}"`,
        header: t('mentioned you'),
        nameInHeader: true,
        onPress: () => openURL(`/groups/${group?.slug}/post/${post.id}`)
      }

    case ACTION_TAG: {
      const topicReason = find(r => r.startsWith('tag: '), meta.reasons)
      const topic = topicReason.split(': ')[1]
      return {
        body: `${t('wrote:')} "${truncateHTML(post.details)}"`,
        header: t('New Post in'),
        objectName: topic,
        onPress: () => openURL(chatUrl(topic, { context: 'group', groupSlug: group?.slug }) + `?postId=${post.id}`)
      }
    }

    case ACTION_NEW_POST: {
      return {
        body: `${t('wrote:')} "${truncateHTML(post.details)}"`,
        header: t('New Post in'),
        objectName: group.name,
        onPress: () => openURL(`/groups/${group?.slug}/post/${post.id}`)
      }
    }

    case ACTION_JOIN_REQUEST:
      return {
        body: t('asked to join'),
        group: group.name,
        header: t('New join request'),
        nameInHeader: true,
        onPress: () => openURL(`/groups/${group?.slug}/settings/requests`)
      }

    case ACTION_APPROVED_JOIN_REQUEST:
      return {
        body: t('approved your request to join'),
        group: group.name,
        header: t('Join Request Approved'),
        onPress: () => openURL(`/groups/${group?.slug}/stream`)
      }
    case ACTION_ANNOUNCEMENT:
      return {
        body: `${t('wrote:')} "${truncateText(post.title)}"`,
        header: t('posted an announcement'),
        nameInHeader: true,
        onPress: () => openURL(`/groups/${group?.slug}/post/${post.id}/edit`),
      }
    case ACTION_TRACK_COMPLETED:
      return {
        body: t('{{name}} completed track {{trackName}}', { name: actor.name, trackName: track.name }),
        header: t('Track Completed'),
        onPress: () => openURL(`${groupUrl(group?.slug, 'tracks')}/${track.id}`)
      }
    case ACTION_TRACK_ENROLLMENT:
      return {
        body: t('{{name}} enrolled in track {{trackName}}', { name: actor.name, trackName: track.name }),
        header: t('Track Enrollment'),
        onPress: () => openURL(`${groupUrl(group?.slug, 'tracks')}/${track.id}`)
      }
    case ACTION_GROUP_CHILD_GROUP_INVITE:
      return {
        body: t('{{name}} invited your group to join {{groupName}}', { name: actor.name, groupName: group.name }),
        header: t('Group Invitation'),
        onPress: () => openURL(`/groups/${otherGroup?.slug}/settings/relationships`, { replace: true })
      }
    case ACTION_GROUP_CHILD_GROUP_INVITE_ACCEPTED:
      return {
        body: t('{{name}} accepted your invitation', { name: otherGroup.name }),
        header: t('Group Joined'),
        onPress: () => openURL(`/groups/${otherGroup?.slug}`, { replace: true })
      }
    case ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST:
      return {
        body: t('{{name}} requested to join {{groupName}}', { name: group.name, groupName: otherGroup.name }),
        header: t('Group Join Request'),
        onPress: () => openURL(`/groups/${otherGroup?.slug}/settings/relationships`, { replace: true })
      }
    case ACTION_GROUP_PARENT_GROUP_JOIN_REQUEST_ACCEPTED:
      return {
        body: t('{{name}} accepted your request', { name: actor.name }),
        header: t('Group Joined'),
        onPress: () => openURL(`/groups/${group?.slug}`, { replace: true })
      }
    case ACTION_GROUP_PEER_GROUP_INVITE:
      return {
        body: t('{{name}} invited your group to form a peer relationship with {{groupName}}', { name: actor.name, groupName: group.name }),
        header: t('Peer Group Invitation'),
        onPress: () => openURL(`/groups/${otherGroup?.slug}/settings/relationships`, { replace: true })
      }
    case ACTION_GROUP_PEER_GROUP_INVITE_ACCEPTED:
      return {
        body: t('{{name}} accepted your peer group invitation', { name: otherGroup.name }),
        header: t('Peer Groups Connected'),
        onPress: () => openURL(`/groups/${otherGroup?.slug}`, { replace: true })
      }
  }
}

export function refineNotification (t) {
  return ({ activity, createdAt, id }, i, notifications) => {
    const { actor, meta, unread } = activity
    // Only show separator between read and unread notifications

    const avatarSeparator = i !== notifications.length - 1
      ? unread !== notifications[i + 1].activity.unread
      : false
    if (ACTION_CHAT === activity.action) {
      console.log('🔍 Mobile Notification WUCKACUCACKCU:', {
      activity,
      createdAt,
      id
    })}
    return {
      id,
      activityId: activity.id,
      actor: pick(['avatarUrl', 'name'], actor),
      avatarSeparator,
      createdAt: TextHelpers.humanDate(createdAt),
      ...refineActivity(activity, t),
      unread,
      reasons: meta.reasons
    }
  }
}

export const refineNotifications = (notifications, t) => {
  if (!notifications) return []
  return notifications
    .map(refineNotification(t))
    .filter(n => n.reasons.every(r => reasonInWhitelist(r, NOTIFICATIONS_WHITELIST)))
}

export function reasonInWhitelist (reason, whitelist) {
  const reasonSubstring = reason.indexOf(':') === -1 ? reason : reason.substring(0, reason.indexOf(':'))
  const response = whitelist.indexOf(reasonSubstring) !== -1
  return response
}
