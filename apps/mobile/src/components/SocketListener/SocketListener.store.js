import { has } from 'lodash/fp'

const MODULE_NAME = 'SocketListener'
export const RECEIVE_POST = `${MODULE_NAME}/RECEIVE_POST`
export const RECEIVE_THREAD = `${MODULE_NAME}/RECEIVE_THREAD`
export const RECEIVE_NOTIFICATION = `${MODULE_NAME}/RECEIVE_NOTIFICATION`
export const HANDLE_EVENT = `${MODULE_NAME}/HANDLE_EVENT`

function safeStringify (obj, space) {
  let cache = []

  const stringified = JSON.stringify(obj, function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return 'removed circular reference'
      }
      cache.push(value)
    }
    return value
  }, space)
  cache = null

  return stringified
}
// remove circular references
function noncircular (obj) {
  if (typeof obj !== 'object') return obj
  return JSON.parse(safeStringify(obj))
}

// TODO: URQL - convert sockets

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

export function receivePost (post) {
  return {
    type: RECEIVE_POST,
    payload: {
      data: {
        post
      }
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

export function handleEvent (name, value) {
  if (has('description.target', value)) {
    value.description.target = null
    value.description.currentTarget = null
  }
  return {
    type: HANDLE_EVENT,
    payload: { name, value: noncircular(value) }
  }
}

export default function reducer (state = {}, action) {
  if (action.type === HANDLE_EVENT) {
    const events = state.events || {}
    const { name, value } = action.payload
    const newState = {
      ...state,
      events: {
        ...events,
        [name]: {
          count: (events[name] ? events[name].count : 0) + 1,
          latest: new Date(),
          value: value && value.message ? value.message : value
        }
      }
    }

    // toggle connected boolean status
    if (['connect', 'reconnect'].includes(name)) {
      newState.connected = true
    } else if (name === 'disconnect') {
      newState.connected = false
    }

    return newState
  }
  return state
}

export function ormSessionReducer (session, action) {
  // const { Me, MessageThread, Post } = session
  const { type, payload } = action

  switch (type) {
    case RECEIVE_NOTIFICATION:
      // // TODO: eventually we might want to refactor this out into a more
      // // structured activity.action handler for the various counts that need
      // // bumping (or handle every single damn thing in ModelExtractor).
      // const { notification: { activity } } = payload.data
      // Me.first().increment('newNotificationCount')

      // if (activity.action === 'newComment' && Post.idExists(activity.post.id)) {
      //   const post = Post.withId(activity.post.id)
      //   post.increment('commentsTotal')
      // }
      break
  }
}
