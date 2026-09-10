import { AsyncLocalStorage } from 'node:async_hooks'
import { withPublicPostMetaTags } from './postMetaTags.js'
import { withPublicGroupMetaTags } from './groupMetaTags.js'

const requestStore = new AsyncLocalStorage()

/**
 * Injects OG tags for a public post or public group into the SPA HTML.
 * Post URLs take precedence over group URLs.
 */
export async function withPublicMetaTags (html, req, opts = {}) {
  const page = await withPublicPostMetaTags(html, req, opts)
  return withPublicGroupMetaTags(page, req, opts)
}

/** Builds the request shape used by the meta-tag injectors from a Node HTTP request. */
export function requestFromNodeReq (req) {
  const forwardedProto = req.headers?.['x-forwarded-proto']
  const protocol = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : null) ||
    (req.socket?.encrypted ? 'https' : 'http')
  return {
    originalUrl: req.originalUrl || req.url,
    url: req.url,
    protocol,
    headers: req.headers || {},
    get: (name) => req.headers?.[String(name).toLowerCase()]
  }
}

function attachRequestContext (server) {
  server.middlewares.use((req, res, next) => {
    requestStore.run(requestFromNodeReq(req), next)
  })
}

/**
 * Vite plugin that injects public post/group OG tags into index.html
 * during `yarn start` / `vite preview`, matching production appMiddleware.
 */
export function publicMetaTagsPlugin () {
  return {
    name: 'hylo-public-meta-tags',
    configureServer: attachRequestContext,
    configurePreviewServer: attachRequestContext,
    transformIndexHtml: {
      order: 'post',
      async handler (html, ctx) {
        const stored = requestStore.getStore()
        const path = stored?.originalUrl || ctx.originalUrl || ctx.path
        if (!path) return html
        const req = stored || {
          originalUrl: path,
          url: path,
          protocol: 'http',
          headers: {},
          get: () => undefined
        }
        return withPublicMetaTags(html, req)
      }
    }
  }
}
