import { cyan } from 'chalk'
import rollbar from '../../lib/rollbar'
import emitter from 'socket.io-emitter'

const validMessageTypes = [
  'commentAdded',
  'messageAdded',
  'userTyping',
  'newThread',
  'newNotification',
  'newPost'
]

var io
let cleanupRegistered = false

function registerCleanup () {
  if (cleanupRegistered || process.env.NODE_ENV === 'test') {
    return
  }

  cleanupRegistered = true

  const cleanup = () => {
    if (io && io.redis) {
      // Close Redis connection
      if (typeof io.redis.quit === 'function') {
        io.redis.quit().catch(err => {
          if (sails && sails.log) {
            sails.log.error('Error closing socket.io-emitter Redis connection:', err)
          }
        })
      } else if (typeof io.redis.disconnect === 'function') {
        io.redis.disconnect()
      }
      io = null
    }
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  process.on('exit', cleanup)
}

export function broadcast (room, messageType, payload, socketToExclude) {
  if (sails.sockets) {
    sails.sockets.broadcast(room, messageType, payload, socketToExclude)
  } else {
    if (!io) {
      io = emitter(process.env.REDIS_URL)
      io.redis.on('error', err => {
        rollbar.error(err, null, {room, messageType, payload})
      })
      registerCleanup()
    }
    io.in(room).emit(messageType, payload) // TODO handle socketToExclude
  }
}

export function pushToSockets (room, messageType, payload, socketToExclude) {
  if (!validMessageTypes.includes(messageType)) {
    throw new Error(`unknown message type: ${messageType}`)
  }

  sails.log.info(`${cyan('Websockets:')} pushToSockets: ${room}, ${messageType}`)
  if (process.env.NODE_ENV === 'test') return Promise.resolve({room, messageType, payload})
  broadcast(room, messageType, payload, socketToExclude)
  return Promise.resolve()
}

const makeRoomAction = method => (req, res, type, id, options = {}) => {
  const callback = options.callback || emptyResponse(res)
  const room = roomTypes[type](id)
  sails.log.info(`${cyan('Websockets:')} ${method}: ${room}`)
  return sails.sockets[method](req, room, callback)
}

export const joinRoom = makeRoomAction('join')
export const leaveRoom = makeRoomAction('leave')

export function userRoom (userId) {
  return `users/${userId}`
}

export function postRoom (postId) {
  return `posts/${postId}`
}

export function groupRoom (groupId) {
  return `groups/${groupId}`
}

const roomTypes = {
  user: userRoom,
  post: postRoom,
  group: groupRoom
}

const emptyResponse = res => err => err ? res.serverError(err) : res.ok({})
