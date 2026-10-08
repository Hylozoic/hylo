/**
 * GraphQL uses same-origin /noo on review Heroku apps; sockets must match so the
 * host-only session cookie from the API proxy is sent on the WebSocket handshake.
 */
export default function resolveSocketHost () {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_SOCKET_HOST
  }
  const { hostname, origin } = window.location
  if (hostname === 'localhost' || hostname.endsWith('hylo.com')) {
    return import.meta.env.VITE_SOCKET_HOST
  }
  return origin
}
