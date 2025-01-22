import socketIo from 'socket.io-client'
import sailsIo from 'sails.io.js'
import apiHost from 'util/apiHost'
import { getSessionCookie } from 'util/session'
import { curry } from 'lodash/fp'

const socketHost = apiHost

let socket, socketPromise

function setupSocketPromise () {
  socketPromise = getSessionCookie().then(cookie => {
    if (!cookie) {
      throw new Error('You must have a session cookie before creating a websocket.')
    }

    const io = sailsIo(socketIo)
    io.sails.environment = process.env.NODE_ENV || 'development'
    io.sails.reconnection = true
    io.sails.autoConnect = false

    // sails.io.js ordinarily uses JSONP to get the cookie, which won't work in a
    // native environment. so we disable that and depend upon having the session
    // cookie already stored from a previous HTTP request.
    io.sails.useCORSRouteToGetCookie = false
    io.sails.headers = { cookie }
    socket = io.sails.connect(socketHost)

    // shim socket.request to include cookie
    socket.__originalRequest = socket.request
    socket.request = function (opts, cb) {
      if (!opts.headers) opts.headers = {}
      opts.headers.cookie = cookie // MAY need to be capitalized
      return this.__originalRequest(opts, cb)
    }

    return socket
  })
}

export function getSocket () {
  if (!socketPromise) setupSocketPromise()
  return socketPromise
}

export function socketUrl (path) {
  return `${socketHost}/${path.replace(/^\//, '')}`
}

export const sendIsTyping = curry((postId, isTyping) => {
  const url = socketUrl(`/noo/post/${postId}/typing`)
  getSocket().then(socket => socket.post(url, { isTyping }))
})

// for testing
export function clearSingletons () {
  socketPromise = null
  socket = null
}
