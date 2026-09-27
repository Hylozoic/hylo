import fetch from 'isomorphic-fetch'
import { debugCheckLogin } from 'config/index'
import { isSandboxMode } from 'sandbox/isSandbox'

export const API_TIMEOUT_MS = 20000

/**
 * True for failures that say nothing about the request itself: the network
 * dropped, the request timed out, or the server errored. These are worth
 * retrying and must not be read as "signed out" or "not found".
 */
export function isTransientApiError (error) {
  if (!error) return false
  if (error.isNetworkError) return true
  const status = error.response?.status
  return typeof status === 'number' && status >= 500
}

function networkError (message, cause) {
  const error = new Error(message)
  error.isNetworkError = true
  if (cause) error.cause = cause
  return error
}

// Only reads are timed out: a slow write may still succeed on the server, and
// abandoning it client-side invites a duplicate when the person retries.
function isReadRequest (path, params, method) {
  if (path === '/noo/graphql') return !/^\s*mutation\b/m.test(params?.query || '')
  return !method || method.toLowerCase() === 'get'
}

export default function apiMiddleware (req) {
  return store => next => action => {
    const { payload, meta } = action

    if (!payload || !payload.api) return next(action)

    const { path, params, method } = payload.api
    const cookie = req && req.headers.cookie

    let promise = isSandboxMode()
      ? sandboxFetch(path, params, method)
      : fetchJSON(path, params, {
        method,
        cookie,
        host: getHost(),
        timeout: isReadRequest(path, params, method) ? API_TIMEOUT_MS : 0
      })

    if (meta && meta.then) {
      promise = promise.then(meta.then)
    }

    return next({ ...action, payload: promise })
  }
}

/**
 * Lazy-load the sandbox transport so the mock engine is not in the main bundle.
 */
function sandboxFetch (path, params, method) {
  return import('sandbox/transport').then(({ sandboxTransport }) =>
    sandboxTransport(path, params, method)
  )
}

export function getHost () {
  if (typeof window === 'undefined') {
    return process.env.VITE_API_HOST
  } else {
    return window.location.origin
  }
}

/**
 * `options.timeout` (ms, default API_TIMEOUT_MS; 0 disables) aborts a request
 * that never completes and rejects with a network error.
 */
export function fetchJSON (path, params, options = {}) {
  const method = options.method ? options.method.toLowerCase() : 'get'
  const fetchURL = (options.host) + path + (method === 'get' && params ? '?' + Object.keys(params).map(k => `${k}=${params[k]}`).join('&') : '')
  const timeout = options.timeout ?? API_TIMEOUT_MS
  const controller = timeout > 0 && typeof AbortController !== 'undefined' ? new AbortController() : null
  let timedOut = false
  const timer = controller
    ? setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    : null
  const fetchOptions = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: options.cookie
    },
    credentials: 'same-origin',
    body: method === 'post' ? JSON.stringify(params) : null,
    ...(controller ? { signal: controller.signal } : {})
  }
  const timeoutError = () => networkError(`Request to ${path} timed out after ${timeout}ms`)
  const processResults = (resp) => {
    const { status, statusText, url } = resp
    if (status === 200) return resp.json()
    return resp.text().then(body => {
      const error = new Error(body)
      error.response = { status, statusText, url, body }
      throw error
    })
  }
  const logGraphql =
    debugCheckLogin &&
    path === '/noo/graphql' &&
    typeof performance !== 'undefined'
  const t0 = logGraphql ? performance.now() : 0
  return fetch(fetchURL, fetchOptions)
    .catch(error => {
      throw timedOut ? timeoutError() : networkError(error?.message || 'Network request failed', error)
    })
    .then(resp => {
      if (logGraphql) {
        console.info(
          '[Hylo GraphQL]',
          `${Math.round(performance.now() - t0)}ms to headers`,
          resp.status,
          fetchURL
        )
      }
      return processResults(resp).then(data => {
        if (logGraphql) {
          console.info('[Hylo GraphQL]', `${Math.round(performance.now() - t0)}ms total (incl. JSON)`)
        }
        return data
      })
    })
    .catch(error => {
      // The abort can also land while the body is still streaming
      if (timedOut && !error?.isNetworkError) throw timeoutError()
      throw error
    })
    .finally(() => clearTimeout(timer))
}
