import {
  POST_TYPE_TO_VIEW_TYPE,
  postCountsTowardChatUnread
} from '@hylo/shared'
import { updateGroupViewInMenu } from 'store/util/groupViewsOrder'

const MODULE_NAME = 'SocketListener'
export const RECEIVE_MESSAGE = `${MODULE_NAME}/RECEIVE_MESSAGE`
export const RECEIVE_MESSAGE_UPDATED = `${MODULE_NAME}/RECEIVE_MESSAGE_UPDATED`
export const RECEIVE_COMMENT = `${MODULE_NAME}/RECEIVE_COMMENT`
export const RECEIVE_POST = `${MODULE_NAME}/RECEIVE_POST`
export const RECEIVE_THREAD = `${MODULE_NAME}/RECEIVE_THREAD`
export const RECEIVE_NOTIFICATION = `${MODULE_NAME}/RECEIVE_NOTIFICATION`
export const RECEIVE_OPEN_JOIN_REQUEST_COUNT = `${MODULE_NAME}/RECEIVE_OPEN_JOIN_REQUEST_COUNT`

export function receiveMessage (message, opts = {}) {
  return {
    type: RECEIVE_MESSAGE,
    payload: {
      data: {
        message
      }
    },
    meta: {
      extractModel: 'Message',
      bumpUnreadCount: opts.bumpUnreadCount,
      isMuted: opts.isMuted
    }
  }
}

export function receiveMessageUpdated (message) {
  return {
    type: RECEIVE_MESSAGE_UPDATED,
    payload: {
      data: {
        message
      }
    }
  }
}

export function receiveComment (comment, opts = {}) {
  return {
    type: RECEIVE_COMMENT,
    payload: {
      data: {
        comment
      }
    },
    meta: {
      extractModel: 'Comment'
    }
  }
}

export function receiveThread (thread) {
  return {
    type: RECEIVE_THREAD,
    payload: {
      data: {
        thread
      }
    },
    meta: {
      extractModel: 'MessageThread'
    }
  }
}

export function receivePost (post, groupId) {
  return {
    type: RECEIVE_POST,
    payload: {
      data: {
        post
      },
      groupId
    },
    meta: {
      extractModel: 'Post'
    }
  }
}

export function receiveNotification (notification) {
  return {
    type: RECEIVE_NOTIFICATION,
    payload: {
      data: {
        notification
      }
    },
    meta: {
      extractModel: 'Notification'
    }
  }
}

/** Set a group's cached open join-request count from a socket payload. */
export function receiveOpenJoinRequestCount (groupId, openJoinRequestCount) {
  return {
    type: RECEIVE_OPEN_JOIN_REQUEST_COUNT,
    payload: { groupId, openJoinRequestCount }
  }
}

/**
 * Bump typed + chat view unread counts for views in `viewItems`, writing through
 * `menuGroup`'s embedded menu (works for top-level and nested space menus).
 */
function bumpUnreadViewsInMenu (menuGroup, viewItems, postType) {
  if (!menuGroup || !viewItems?.length) return

  const typedViewType = POST_TYPE_TO_VIEW_TYPE[postType]
  if (typedViewType) {
    const typedView = viewItems.find(view => view.type === typedViewType)
    if (typedView) {
      updateGroupViewInMenu(menuGroup, typedView.id, {
        newPostCount: (typedView.newPostCount || 0) + 1
      })
    }
  }

  if (postCountsTowardChatUnread(postType)) {
    const chatView = viewItems.find(view => view.type === 'chat')
    if (chatView) {
      updateGroupViewInMenu(menuGroup, chatView.id, {
        newPostCount: (chatView.newPostCount || 0) + 1
      })
    }
  }
}

export function ormSessionReducer (session, { meta, type, payload }) {
  const { Group, Message, MessageThread, Membership, Me } = session
  let currentUser

  switch (type) {
    case RECEIVE_MESSAGE: {
      const id = payload.data.message.messageThread
      const isMuted = meta.isMuted || (MessageThread.idExists(id) && MessageThread.withId(id).isMuted)

      if (!MessageThread.idExists(id)) {
        MessageThread.create({
          id,
          updatedAt: new Date().toString(),
          lastReadAt: 0,
          unreadCount: 0,
          isMuted: !!meta.isMuted
        })
      } else if (meta.isMuted) {
        MessageThread.withId(id).update({ isMuted: true })
      }

      MessageThread.withId(id).newMessageReceived(meta.bumpUnreadCount)

      if (meta.bumpUnreadCount && !isMuted) {
        currentUser = Me.first()
        currentUser.update({
          unseenThreadCount: currentUser.unseenThreadCount + 1
        })
      }
      break
    }

    case RECEIVE_MESSAGE_UPDATED: {
      const updatedMessage = payload.data.message
      const messageId = updatedMessage.id
      if (Message.idExists(messageId)) {
        Message.withId(messageId).update({
          text: updatedMessage.text,
          editedAt: updatedMessage.editedAt
            ? new Date(updatedMessage.editedAt).toString()
            : undefined
        })
      }
      break
    }

    case RECEIVE_POST: {
      currentUser = Me.first()
      const { post } = payload.data
      const groupId = payload.groupId
      const creatorId = post.creator?.id || post.creatorId
      if (!currentUser || !groupId || String(creatorId) === String(currentUser.id)) break
      if (post.type === 'chat_activity') break

      const increment = obj =>
        obj && obj.update({
          newPostCount: (obj.newPostCount || 0) + 1
        })

      // Space/group orange dot — membership for the post's group
      increment(Membership.safeGet({ group: groupId, person: currentUser.id }))

      const postType = post.type
      const postGroup = Group.withId(groupId)

      // Direct menu on the post's group (when that group's views are loaded)
      if (postGroup?.groupViews?.items?.length) {
        bumpUnreadViewsInMenu(postGroup, postGroup.groupViews.items, postType)
      }

      // Parent menus embed space views under type=space linkedGroup — patch those too
      // so badges update while the parent group's ContextMenu is open.
      Group.all().toModelArray().forEach(parentGroup => {
        if (String(parentGroup.id) === String(groupId)) return
        const items = parentGroup.groupViews?.items || []
        items.forEach(view => {
          if (view.type !== 'space') return
          if (String(view.linkedGroup?.id) !== String(groupId)) return
          const nestedItems = view.linkedGroup.groupViews?.items
          if (!nestedItems?.length) return
          bumpUnreadViewsInMenu(parentGroup, nestedItems, postType)
        })
      })
      break
    }

    case RECEIVE_NOTIFICATION: {
      currentUser = Me.first()
      currentUser.update({
        newNotificationCount: currentUser.newNotificationCount + 1
      })

      if (window.electron) {
        const notification = payload.data.notification

        window.electron.setBadgeCount(currentUser.newNotificationCount)
        window.electron.showNotification(notification)
      }
      break
    }

    case RECEIVE_OPEN_JOIN_REQUEST_COUNT: {
      const { groupId, openJoinRequestCount } = payload
      if (groupId == null || openJoinRequestCount == null) break
      const count = Math.max(0, Number(openJoinRequestCount) || 0)
      if (Group.idExists(groupId)) {
        Group.withId(groupId).update({ openJoinRequestCount: count })
      }
      // Nested menu copies can lag behind the normalized Group record.
      Group.all().toModelArray().forEach(parent => {
        const items = parent.groupViews?.items
        if (items?.length) {
          let changed = false
          const nextItems = items.map(view => {
            if (view.type !== 'space' || String(view.linkedGroup?.id) !== String(groupId)) return view
            changed = true
            return {
              ...view,
              linkedGroup: { ...view.linkedGroup, openJoinRequestCount: count }
            }
          })
          if (changed) {
            parent.update({ groupViews: { ...parent.groupViews, items: nextItems } })
          }
        }
        const spaces = parent.spaces?.items
        if (spaces?.length) {
          let spacesChanged = false
          const nextSpaces = spaces.map(space => {
            if (String(space.id) !== String(groupId)) return space
            spacesChanged = true
            return { ...space, openJoinRequestCount: count }
          })
          if (spacesChanged) {
            parent.update({ spaces: { ...parent.spaces, items: nextSpaces } })
          }
        }
      })
      break
    }
  }
}
