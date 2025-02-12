import { isEqual } from 'lodash'
import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { getSocket, socketUrl } from 'client/websockets.js'
import rollbar from 'client/rollbar'
import useRouteParams from 'hooks/useRouteParams'
import {
  receiveThread,
  receiveMessage,
  receiveComment,
  receiveNotification,
  receivePost
} from './SocketListener.store'
import {
  addUserTyping,
  clearUserTyping
} from 'components/PeopleTyping/PeopleTyping.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

const SocketListener = (props) => {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const handlers = useMemo(() => ({
    commentAdded: data => dispatch(receiveComment(data)),
    messageAdded: data => {
      const message = convertToMessage(data)
      dispatch(receiveMessage(message, {
        bumpUnreadCount: !isActiveThread(location, data)
      }))
    },
    newNotification: data => dispatch(receiveNotification(data)),
    newPost: data => dispatch(receivePost(data, group.id)),
    newThread: data => dispatch(receiveThread(convertToThread(data))),
    userTyping: ({ userId, userName, isTyping }) => {
      isTyping ? dispatch(addUserTyping(userId, userName)) : dispatch(clearUserTyping(userId))
    }
  }), [location, group?.id])

  useEffect(() => {
    const socket = getSocket()
    reconnect(socket)

    Object.keys(handlers).forEach(socketEvent =>
      socket.on(socketEvent, handlers[socketEvent]))

    return () => {
      socket.post(socketUrl('/noo/threads/unsubscribe'))
      Object.keys(handlers).forEach(socketEvent =>
        socket.off(socketEvent, handlers[socketEvent]))
    }
  }, [handlers])

  const reconnect = (socket) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('connecting SocketListener...')
    }

    socket.post(socketUrl('/noo/threads/subscribe'), (body, jwr) => {
      if (!isEqual(body, {})) {
        rollbar.error(`Failed to connect SocketListener: ${body}`)
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
      messages: data.messages.map(({ id, createdAt, text, creator }) => ({
        id,
        text,
        creator,
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
      createdAt: new Date(data.createdAt).toString()
    }
  }

  const { message: { id, created_at: createdAt, text, user_id: userId }, postId } = data
  return {
    id,
    createdAt: new Date(createdAt).toString(),
    text,
    creator: userId,
    messageThread: postId
  }
}

function isActiveThread (location, data) {
  const [namespace, id] = location.pathname.split('/').slice(1, 3)
  return namespace === 't' && data.postId === id
}
