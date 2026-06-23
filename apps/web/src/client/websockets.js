import curry from 'lodash/curry'
import socketIOClient from 'socket.io-client'
import sailsIOClient from 'sails.io.js'

const environment = import.meta.env.PROD || 'development'
const socketHost = import.meta.env.VITE_SOCKET_HOST
const isClient = typeof window !== 'undefined' && !window.isMock

let socket // client-side singleton
let socketHeartbeatStarted = false

/** v2 mobile WebView injects this before page JS; native owns session cookies there. */
function isMobileV2WebView () {
  return typeof window !== 'undefined' && window.HyloMobileV2
}

if (isClient) {
  const io = sailsIOClient(socketIOClient)
  const mobileV2 = isMobileV2WebView()

  io.sails.url = socketHost

  // In the v2 mobile WebView, native mints the session cookie before load. The
  // cross-origin __getcookie handshake can clobber it with a stale anonymous cookie.
  io.sails.useCORSRouteToGetCookie = !mobileV2

  // Defer the socket connection until after checkLogin succeeds in mobile WebView.
  io.sails.autoConnect = !mobileV2

  io.sails.environment = environment
  io.sails.reconnection = true
  socket = io.socket

  if (!mobileV2) {
    startSocketHeartbeat()
  }
} else {
  const noop = () => {}
  socket = { get: noop, post: noop, on: noop, off: noop }
}

/**
 * Opens the sails.io socket connection. No-op on server and when already started.
 * Called from RootRouter after mobile WebView auth succeeds.
 */
export function connectSocket () {
  if (!isClient || socketHeartbeatStarted) return
  startSocketHeartbeat()
}

function startSocketHeartbeat () {
  if (socketHeartbeatStarted) return
  socketHeartbeatStarted = true

  const HEARTBEAT_PATH = '/noo/heartbeat'
  const INTERVAL_MS = 30000
  const TIMEOUT_MS = 10000
  let consecutiveFailures = 0

  const forceReconnect = () => {
    try {
      const raw = socket._raw || socket
      if (raw && raw.io && typeof raw.io.reconnect === 'function') raw.io.reconnect()
      else if (raw && typeof raw.connect === 'function') raw.connect()
      else if (raw && typeof raw.open === 'function') raw.open()
    } catch (e) {}
  }

  const heartbeat = () => {
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
      if (document.visibilityState === 'visible') heartbeat()
    })
  }
}

export const socketUrl = path => `${socketHost}/${path.replace(/^\//, '')}`

export const getSocket = () => socket

// for testing
export const setSocket = mock => { socket = mock }

export const sendIsTyping = curry((postId, isTyping) => {
  const url = socketUrl(`/noo/post/${postId}/typing`)
  getSocket().post(url, { isTyping })
})
