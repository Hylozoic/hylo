import { API_HOST } from './config'

export default async function fetchJSON (path, params, options = {}) {
  const { host, method } = options
  const requestUrl = (host || API_HOST) + path
  const requestParams = {
    method: method || 'get',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
    credentials: 'include' // Include cookies for session management
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
    // TODO: Handle session cookies if needed
    return response.json()
  }

  return response.text().then(body => {
    const error = new Error(body)
    error.response = { status, statusText, url, body }
    throw error
  })
}