import { TextHelpers } from '@hylo/shared'
import { bodyForNotification, titleForNotification } from 'store/models/Notification'

const MODULE_NAME = 'SocketListener'
export const RECEIVE_MESSAGE = `${MODULE_NAME}/RECEIVE_MESSAGE`
export const RECEIVE_COMMENT = `${MODULE_NAME}/RECEIVE_COMMENT`
export const RECEIVE_POST = `${MODULE_NAME}/RECEIVE_POST`
export const RECEIVE_THREAD = `${MODULE_NAME}/RECEIVE_THREAD`
export const RECEIVE_NOTIFICATION = `${MODULE_NAME}/RECEIVE_NOTIFICATION`

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
      bumpUnreadCount: opts.bumpUnreadCount
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

export function ormSessionReducer (session, { meta, type, payload }) {
  const { Group, MessageThread, Membership, TopicFollow, Me } = session
  let currentUser

  switch (type) {
    case RECEIVE_MESSAGE: {
      currentUser = Me.first()
      currentUser.update({
        unseenThreadCount: currentUser.unseenThreadCount + 1
      })

      const id = payload.data.message.messageThread
      if (!MessageThread.idExists(id)) {
        MessageThread.create({
          id,
          updatedAt: new Date().toString(),
          lastReadAt: 0,
          unreadCount: 0
        })
      }
      MessageThread.withId(id).newMessageReceived(meta.bumpUnreadCount)
      break
    }

    case RECEIVE_POST: {
      currentUser = Me.first()
      const { post } = payload.data
      const groupId = payload.groupId
      if (currentUser && post.creatorId !== currentUser.id) {
        const increment = obj =>
          obj && obj.update({
            newPostCount: (obj.newPostCount || 0) + 1
          })

        increment(TopicFollow.filter(tf =>
          post.topics.some(t => t.id === tf.topic) && tf.group === groupId).first())

        const group = Group.withId(groupId)
        const contextWidgets = group.contextWidgets.items
        const newContextWidgets = contextWidgets.map(cw => {
          if (cw.type === 'chat' && post.topics.some(t => t.id === cw.viewChat?.id)) {
            return { ...cw, highlightNumber: cw.highlightNumber + 1 }
          }
          return cw
        })
        group.update({ contextWidgets: { items: structuredClone(newContextWidgets) } })

        // TODO: is this working?
        increment(Membership.filter(m =>
          !m.person && m.group === groupId).first())
      }
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
        const title = TextHelpers.presentHTMLToText(titleForNotification(notification))
        const body = TextHelpers.presentHTMLToText(bodyForNotification(notification))
        window.electron.showNotification(title, body)
      }
      break
    }
  }
}
