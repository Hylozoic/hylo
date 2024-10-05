import { createSelector } from 'reselect'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { get, find, pick } from 'lodash/fp'
import { TextHelpers } from 'hylo-shared'
import orm from 'store/models'
import { makeGetQueryResults } from 'store/reducers/queryResults'
import { modalScreenName } from 'hooks/useIsModalScreen'
import {
  ACTION_NEW_COMMENT,
  ACTION_TAG,
  ACTION_JOIN_REQUEST,
  ACTION_APPROVED_JOIN_REQUEST,
  ACTION_MENTION,
  ACTION_COMMENT_MENTION,
  ACTION_ANNOUNCEMENT,
  ACTION_NEW_POST
} from 'store/models/Notification'
import gql from 'graphql-tag'

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
export const MODULE_NAME = 'NotificationsList'
export const FETCH_NOTIFICATIONS = `${MODULE_NAME}/FETCH_NOTIFICATIONS`
export const MARK_ACTIVITY_READ = `${MODULE_NAME}/MARK_ACTIVITY_READ`
export const MARK_ALL_ACTIVITIES_READ = `${MODULE_NAME}/MARK_ALL_ACTIVITIES_READ`
export const UPDATE_NEW_NOTIFICATION_COUNT = `${MODULE_NAME}/UPDATE_NEW_NOTIFICATION_COUNT`
export const UPDATE_NEW_NOTIFICATION_COUNT_PENDING = `${UPDATE_NEW_NOTIFICATION_COUNT}_PENDING`

export function fetchNotifications (first = 20, offset = 0) {
  return {
    type: FETCH_NOTIFICATIONS,
    graphql: {
      query: gql`
        query ($first: Int, $offset: Int) {
          notifications (first: $first, offset: $offset, order: "desc") {
            total
            hasMore
            items {
              id
              createdAt
              activity {
                id
                actor {
                  id
                  name
                  avatarUrl
                }
                comment {
                  id
                  text
                }
                post {
                  id
                  title
                  details
                  groups {
                    id
                    slug
                  }  
                }
                group {
                  id
                  name
                  slug
                }
                meta {
                  reasons
                }
                action
                unread
              }
            }
          }
        }
      `,
      variables: { first, offset }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'Notification',
      extractQueryResults: {
        getItems: get('payload.data.notifications')
      },
      resetCount: true
    }
  }
}

export function markActivityRead (id) {
  return {
    type: MARK_ACTIVITY_READ,
    graphql: {
      query: gql`
        mutation ($id: ID) {
          markActivityRead(id: $id) {
            id
          }
        }
      `,
      variables: { id }
    },
    meta: {
      id,
      optimistic: true
    }
  }
}

export function markAllActivitiesRead () {
  return {
    type: MARK_ALL_ACTIVITIES_READ,
    graphql: {
      query: gql`
        mutation {
          markAllActivitiesRead {
            success
          }
        }
      `
    },
    meta: {
      optimistic: true
    }
  }
}

export function updateNewNotificationCount () {
  return {
    type: UPDATE_NEW_NOTIFICATION_COUNT,
    graphql: {
      query: gql`
        mutation ($changes: MeInput) {
          updateMe(changes: $changes) {
            id
          }
        }
      `,
      variables: {
        changes: {
          newNotificationCount: 0
        }
      }
    },
    meta: {
      optimistic: true
    }
  }
}

export const truncateHTML = html => TextHelpers.presentHTMLToText(html, { truncate: NOTIFICATION_TEXT_MAX }).replace(/\n/g, ' ')

export const truncateText = text => TextHelpers.truncateText(text, NOTIFICATION_TEXT_MAX)

export function refineActivity ({ action, actor, comment, group, post, meta }, { navigate }) {
  switch (action) {
    case ACTION_COMMENT_MENTION:
      return {
        body: `wrote: ${truncateHTML(comment.text)}`,
        header: 'mentioned you in a comment on',
        nameInHeader: true,
        onPress: () => navigate(modalScreenName('Post Details'), { id: post.id }),
        title: post.title
      }

    case ACTION_NEW_COMMENT:
      return {
        body: `wrote: "${truncateHTML(comment.text)}"`,
        header: 'New Comment on',
        onPress: () => navigate(modalScreenName('Post Details'), { id: post.id }),
        title: post.title
      }

    case ACTION_MENTION:
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'mentioned you',
        onPress: () => navigate(modalScreenName('Post Details'), { id: post.id }),
        nameInHeader: true
      }

    case ACTION_TAG: {
      const topicReason = find(r => r.startsWith('tag: '), meta.reasons)
      const topic = topicReason.split(': ')[1]
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'New Post in',
        onPress: () => {
          navigate('Chat', { topicName: topic, postId: post.id })
        },
        objectName: topic
      }
    }

    case ACTION_NEW_POST: {
      return {
        body: `wrote: "${truncateHTML(post.details)}"`,
        header: 'New Post in',
        onPress: () => navigate(modalScreenName('Post Details'), { id: post.id }),
        objectName: group.name
      }
    }

    case ACTION_JOIN_REQUEST:
      return {
        body: 'asked to join',
        group: group.name,
        header: 'New join request',
        nameInHeader: true,
        onPress: () => navigate('Group Settings', {
          screen: 'Join Requests',
          params: {
            groupId: group.id, groupSlug: group.slug
          }
        })
      }

    case ACTION_APPROVED_JOIN_REQUEST:
      return {
        body: 'approved your request to join',
        group: group.name,
        header: 'Join Request Approved',
        onPress: () => navigate('Stream', { groupId: group.id })
      }
    case ACTION_ANNOUNCEMENT:
      return {
        body: `wrote: "${truncateText(post.title)}"`,
        header: 'posted an announcement',
        onPress: () => navigate(modalScreenName('Post Details'), { id: post.id }),
        nameInHeader: true
      }
  }
}

export function refineNotification (navigation) {
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
      ...refineActivity(activity, navigation),
      unread,
      reasons: meta.reasons
    }
  }
}

const getNotificationsResults = makeGetQueryResults(FETCH_NOTIFICATIONS)

export const getHasMoreNotifications = createSelector(
  getNotificationsResults,
  get('hasMore')
)

export const getNotifications = ormCreateSelector(
  orm,
  (_, { navigation }) => navigation,
  (session, navigation) => session.Notification
    .all()
    .orderBy(m => Number(m.id), 'desc')
    .toModelArray()
    .map(refineNotification(navigation))
    .filter(n => n.reasons.every(r => reasonInWhitelist(r, NOTIFICATIONS_WHITELIST)))
)

export function reasonInWhitelist (reason, whitelist) {
  const reasonSubstring = reason.indexOf(':') === -1 ? reason : reason.substring(0, reason.indexOf(':'))
  const response = whitelist.indexOf(reasonSubstring) !== -1
  return response
}
