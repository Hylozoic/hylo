import curry from 'lodash/curry'
import socketIOClient from 'socket.io-client'
import sailsIOClient from 'sails.io.js'

const environment = import.meta.env.PROD || 'development'
const socketHost = import.meta.env.VITE_SOCKET_HOST
const isClient = typeof window !== 'undefined' && !window.isMock

let socket // client-side singleton

if (isClient) {
  const io = sailsIOClient(socketIOClient)

  // Configure the connection URL
  io.sails.url = socketHost

  // Optional: configure additional options
  io.sails.autoConnect = true

  // XXX: this is needed with our current setup on production, to get the session cookie from the server, using the API host, and enable logging in at all.
  // Otherwise, the session cookie is does not come through when calling https://www.hylo.com/noo/graphql,and the login fails
  io.sails.useCORSRouteToGetCookie = true

  io.sails.environment = environment
  io.sails.reconnection = true
  socket = io.socket

  // Heartbeat + self-heal reconnect
  const startSocketHeartbeat = (() => {
    let started = false
    return () => {
      if (started) return
      started = true

      console.log('startSocketHeartbeat sockets')

      const HEARTBEAT_PATH = '/noo/heartbeat'
      const INTERVAL_MS = 30000
      const TIMEOUT_MS = 10000
      let consecutiveFailures = 0

      const forceReconnect = () => {
        try {
          console.log('forceReconnect sockets')
          const raw = socket._raw || socket
          if (raw && raw.io && typeof raw.io.reconnect === 'function') raw.io.reconnect()
          else if (raw && typeof raw.connect === 'function') raw.connect()
          else if (raw && typeof raw.open === 'function') raw.open()
        } catch (e) {}
      }

      const heartbeat = () => {
        console.log('heartbeat sockets')
        const isConnected = typeof socket.isConnected === 'function'
          ? socket.isConnected()
          : !!(socket._raw && socket._raw.connected)

        if (!isConnected) {
          forceReconnect()
          return
        }

        let responded = false
        const timeoutId = setTimeout(() => {
          if (responded) return
          consecutiveFailures += 1
          if (consecutiveFailures >= 2) forceReconnect()
        }, TIMEOUT_MS)

        // Any response (even 404) indicates transport liveness
        socket.get(socketUrl(HEARTBEAT_PATH), () => {
          responded = true
          clearTimeout(timeoutId)
          consecutiveFailures = 0
        })
      }

      heartbeat()
      setInterval(heartbeat, INTERVAL_MS)

      if (typeof window !== 'undefined') {
        window.addEventListener('online', forceReconnect)
        document.addEventListener('visibilitychange', () => {
          console.log('visibilitychange sockets')
          if (document.visibilityState === 'visible') heartbeat()
        })
      }
    }
  })()

  startSocketHeartbeat()
} else {
  const noop = () => {}
  socket = { get: noop, post: noop, on: noop, off: noop }
}

export const socketUrl = path => `${socketHost}/${path.replace(/^\//, '')}`

export const getSocket = () => socket

// for testing
export const setSocket = mock => { socket = mock }

export const sendIsTyping = curry((postId, isTyping) => {
  const url = socketUrl(`/noo/post/${postId}/typing`)
  getSocket().post(url, { isTyping })
})
