import fetch from 'isomorphic-fetch'
import { debugCheckLogin } from 'config/index'

export default function apiMiddleware (req) {
  return store => next => action => {
    const { payload, meta } = action

    if (!payload || !payload.api) return next(action)

    const { path, params, method } = payload.api
    const cookie = req && req.headers.cookie

    let promise = fetchJSON(path, params, { method, cookie, host: getHost() })

    if (meta && meta.then) {
      promise = promise.then(meta.then)
    }

    return next({ ...action, payload: promise })
  }
}

export function getHost () {
  if (typeof window === 'undefined') {
    return process.env.VITE_API_HOST
  } else {
    return window.location.origin
  }
}

export function fetchJSON (path, params, options = {}) {
  const method = options.method ? options.method.toLowerCase() : 'get'
  const fetchURL = (options.host) + path + (method === 'get' && params ? '?' + Object.keys(params).map(k => `${k}=${params[k]}`).join('&') : '')
  // Only set Cookie when SSR passed a real header. On the client `req` is absent so
  // `options.cookie` is undefined — sending that as a header can break WKWebView
  // same-origin fetches that must use the document cookie jar (e.g. CheckLogin in-app).
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
  if (options.cookie) {
    headers.Cookie = options.cookie
  }
  const fetchOptions = {
    method,
    headers,
    credentials: 'same-origin',
    body: method === 'post' ? JSON.stringify(params) : null
  }
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
}
