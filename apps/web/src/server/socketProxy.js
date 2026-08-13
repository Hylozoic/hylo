import httpProxy from 'http-proxy'

/**
 * Proxies sails.io / socket.io to VITE_API_HOST so review-app frontends can use
 * same-origin WebSockets and send the host-only session cookie from /noo proxy.
 */
export default function createSocketProxy (apiHost) {
  const target = (apiHost || '').replace(/\/$/, '')
  const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true })

  proxy.on('error', (err, req, res) => {
    console.error('Socket proxy error:', err.message)
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502)
      res.end()
    }
  })

  return {
    middleware (req, res, next) {
      if (!req.url.startsWith('/socket.io')) return next()
      proxy.web(req, res, { target })
    },
    attachUpgrade (server) {
      server.on('upgrade', (req, socket, head) => {
        if (!req.url?.startsWith('/socket.io')) return
        proxy.ws(req, socket, head, { target })
      })
    }
  }
}
