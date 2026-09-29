import { isEqual } from 'lodash'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { push } from 'redux-first-history'
import { getSocket, socketUrl } from 'client/websockets.js'
import errorReporter from 'client/errorReporter'
import useRouteParams from 'hooks/useRouteParams'
import {
  receiveThread,
  receiveMessage,
  receiveMessageUpdated,
  receiveComment,
  receiveNotification,
  receivePost,
  receiveOpenJoinRequestCount
} from './SocketListener.store'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getMe from 'store/selectors/getMe'
import {
  addUserTyping,
  clearUserTyping
} from 'components/PeopleTyping/PeopleTyping.store'
import { addMemberPresent, removeMemberPresent, setRoomPresence } from 'routes/ChatRoom/RoomPresence.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { refreshBadgeCounts } from 'util/badgeRefresh'
import { createToaster } from './directToasts'

const SocketListener = (props) => {
  const dispatch = useDispatch()
  const store = useStore()
  const { t } = useTranslation()
  const location = useLocation()
  const locationRef = useRef(location)
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const currentUser = useSelector(getMe)

  // Need to keep the location up to date without causing handlers to rerender and us to reconnect to the sockets on every location change
  useEffect(() => {
    locationRef.current = location
  }, [location])

  // Toasts for direct notifications and messages (D71), fired here rather than in a reducer
  const toaster = useMemo(() => createToaster({
    getState: store.getState,
    t,
    open: url => dispatch(push(url))
  }), [dispatch, store, t])

  const handlers = useMemo(() => ({
    commentAdded: data => dispatch(receiveComment(data)),
    groupUpdated: (data) => {
      if (!group?.id || !data?.groupId) return
      if (String(data.groupId) !== String(group.id)) return
      if (data?.updatedByUserId && String(data.updatedByUserId) === String(currentUser?.id)) return
      dispatch(fetchGroupViews(group.id))
    },
    messageAdded: (data) => {
      const message = convertToMessage(data)
      const viewingThread = isActiveThread(locationRef.current, data)
      dispatch(receiveMessage(message, {
        bumpUnreadCount: !viewingThread,
        isMuted: data.isMuted
      }))
      toaster.message(message, { viewingThread, isMuted: data.isMuted })
    },
    messageUpdated: data => dispatch(receiveMessageUpdated(convertToMessage(data))),
    newNotification: data => {
      dispatch(receiveNotification(data))
      toaster.notification(data, { pathname: locationRef.current.pathname })
    },
    openJoinRequestCountUpdated: (data) => {
      if (data?.groupId == null || data?.openJoinRequestCount == null) return
      dispatch(receiveOpenJoinRequestCount(data.groupId, data.openJoinRequestCount))
    },
    // Use the post's group from the socket payload — not the currently viewed group.
    // Space posts are also pushed to the parent room so the parent menu can badge
    // without joining every space room.
    newPost: data => {
      const postGroupId = data?.groups?.[0]?.id
      if (!postGroupId) return
      dispatch(receivePost(data, postGroupId))
    },
    newThread: data => {
      const thread = convertToThread(data)
      dispatch(receiveThread(thread))
      toaster.thread(thread, {
        viewingThread: isActiveThread(locationRef.current, { messageThread: String(thread.id) }),
        isMuted: data.isMuted
      })
    },
    userTyping: ({ userId, userName, isTyping, groupId, postId }) => {
      isTyping ? dispatch(addUserTyping(userId, userName, { groupId, postId })) : dispatch(clearUserTyping(userId))
    },
    // Live room rosters (see RoomPresence.store)
    roomPresence: ({ groupId, members }) => dispatch(setRoomPresence(groupId, members)),
    memberPresent: ({ groupId, member }) => dispatch(addMemberPresent(groupId, member)),
    memberAway: ({ groupId, userId }) => dispatch(removeMemberPresent(groupId, userId))
  }), [currentUser?.id, dispatch, group?.id, toaster])

  useEffect(() => {
    const socket = getSocket()
    // Re-subscribe the user room on every (re)connection — after a server
    // restart the socket comes back but its room memberships do not
    const resubscribe = () => reconnect(socket)
    // Pushes sent while disconnected are lost, so the badges they would have
    // bumped are refetched
    const handleReconnect = () => {
      reconnect(socket)
      refreshBadgeCounts(dispatch)
    }
    reconnect(socket)
    socket.on('connect', resubscribe)
    socket.on('reconnect', handleReconnect)

    Object.keys(handlers).forEach(socketEvent =>
      socket.on(socketEvent, handlers[socketEvent]))

    return () => {
      socket.off('connect', resubscribe)
      socket.off('reconnect', handleReconnect)
      socket.post(socketUrl('/noo/user/unsubscribe'))
      Object.keys(handlers).forEach(socketEvent =>
        socket.off(socketEvent, handlers[socketEvent]))
    }
  }, [dispatch, handlers])

  const reconnect = (socket) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('connecting SocketListener...')
    }

    socket.post(socketUrl('/noo/user/subscribe'), (body, jwr) => {
      if (!isEqual(body, {})) {
        errorReporter.error(`Failed to connect SocketListener: ${body}`)
      }
    })
  }

  return null
}

export default SocketListener

// Helper functions
function convertToThread (data) {
  if (data.createdAt) {
    return {
      ...data,
      createdAt: new Date(data.createdAt).toString(),
      updatedAt: new Date(data.updatedAt).toString(),
      messages: data.messages.map(({ id, createdAt, text, creator, attachments }) => ({
        id,
        text,
        creator,
        attachments,
        createdAt: new Date(createdAt).toString(),
        messageThread: data.id
      })),
      unreadCount: 1
    }
  }

  const { id, created_at: createdAt, updated_at: updatedAt, people, comments } = data
  return {
    id,
    createdAt: new Date(createdAt).toString(),
    updatedAt: new Date(updatedAt).toString(),
    participants: people.map(({ id, name, avatar_url: avatarUrl }) => ({ id, name, avatarUrl })),
    messages: comments.map(c => convertToMessage({ message: c, postId: id })),
    unreadCount: 1
  }
}

function convertToMessage (data) {
  if (data.createdAt) {
    return {
      ...data,
      createdAt: new Date(data.createdAt).toString(),
      editedAt: data.editedAt ? new Date(data.editedAt).toString() : undefined
    }
  }

  const { message: { id, created_at: createdAt, edited_at: editedAt, text, user_id: userId }, postId } = data
  return {
    id,
    createdAt: new Date(createdAt).toString(),
    editedAt: editedAt ? new Date(editedAt).toString() : undefined,
    text,
    creator: userId,
    messageThread: postId
  }
}

function isActiveThread (location, data) {
  const [namespace, id] = location.pathname.split('/').slice(1, 3)
  return namespace === 'messages' && data.messageThread === id
}
