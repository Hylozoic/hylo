import { isDev, isTest } from 'config/index'
import { isSandboxMode } from './isSandbox'
import { sandboxTransport } from './transport'

const ALLOWED_NOO_PREFIXES = [
  '/noo/graphql',
  '/noo/upload',
  '/noo/session',
  '/noo/cookie-consent',
  '/noo/heartbeat'
]

let installed = false

/**
 * Wrap window.fetch so sandbox never reaches the real Hylo API.
 * /noo/graphql and /noo/upload are answered by sandboxTransport; other /noo/*
 * paths are blocked. Non-/noo requests (Mapbox, Sentry, CDN) pass through.
 */
export function installSandboxFetchGuard () {
  if (installed || typeof window === 'undefined' || !isSandboxMode()) return
  if (typeof window.fetch !== 'function') return

  const originalFetch = window.fetch.bind(window)
  installed = true

  window.fetch = async function sandboxFetch (input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url
    if (!isHyloNooUrl(url)) {
      return originalFetch(input, init)
    }

    const pathname = hyloNooPathname(url)
    const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()

    if (pathname.endsWith('/noo/graphql') || pathname === '/noo/graphql') {
      const params = await readJsonBody(input, init)
      const result = await sandboxTransport('/noo/graphql', params, method)
      return jsonResponse(result)
    }

    if (pathname.endsWith('/noo/upload') || pathname === '/noo/upload') {
      const params = await readJsonBody(input, init)
      const result = await sandboxTransport('/noo/upload', params, method)
      return jsonResponse(result)
    }

    if (pathname.endsWith('/noo/session') || pathname === '/noo/session') {
      return jsonResponse(await sandboxTransport('/noo/session', {}, method))
    }

    if (
      pathname.includes('/noo/cookie-consent') ||
      pathname.includes('/noo/heartbeat')
    ) {
      return jsonResponse({ success: true })
    }

    if (isAllowedNooPath(pathname)) {
      return jsonResponse({})
    }

    const message = `[sandbox] blocked fetch to ${pathname}`
    if (isDev && !isTest) {
      console.warn(message)
    }
    return jsonResponse({ error: 'Blocked in sandbox' }, 403)
  }
}

function isHyloNooUrl (url) {
  if (!url) return false
  try {
    const parsed = new URL(String(url), window.location.origin)
    return parsed.pathname.includes('/noo/')
  } catch (err) {
    return String(url).includes('/noo/')
  }
}

function hyloNooPathname (url) {
  try {
    return new URL(String(url), window.location.origin).pathname
  } catch (err) {
    return String(url)
  }
}

function isAllowedNooPath (pathname) {
  return ALLOWED_NOO_PREFIXES.some(prefix => pathname.includes(prefix))
}

async function readJsonBody (input, init) {
  if (init?.body) {
    if (typeof init.body === 'string') {
      try {
        return JSON.parse(init.body)
      } catch (err) {
        return {}
      }
    }
    return {}
  }
  if (typeof input !== 'string' && typeof input?.clone === 'function') {
    try {
      return await input.clone().json()
    } catch (err) {
      return {}
    }
  }
  return {}
}

function jsonResponse (data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
