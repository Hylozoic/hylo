import { setSessionCookie } from 'util/session'
import { getTokens } from 'util/tokenStore'
import apiHost from 'util/apiHost'

export default async function fetchJSON (path, params, options = {}) {
  const { host, method } = options
  const requestUrl = (host || apiHost) + path
  const requestParams = {
    method: method || 'get',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
    withCredentials: true
  }

  // Attach the Bearer token (mobile token-auth path) when present; falls back to
  // the session cookie otherwise.
  const tokens = await getTokens()
  if (tokens?.access_token) {
    requestParams.headers.Authorization = `Bearer ${tokens.access_token}`
  }

  if (options.headers) {
    requestParams.headers = {
      ...requestParams.headers,
      ...options.headers
    }
  }

  const response = await fetch(requestUrl, requestParams)
  const { status, statusText, url } = response

  if (status === 200) {
    await setSessionCookie(response)
    return response.json()
  }

  return response.text().then(body => {
    const error = new Error(body)
    error.response = { status, statusText, url, body }
    throw error
  })
}
