import fetch from 'isomorphic-fetch'
import apiMiddleware, { fetchJSON, isTransientApiError, SESSION_CHECK_TIMEOUT_MS } from './apiMiddleware'
import checkLogin from 'store/actions/checkLogin'

jest.mock('isomorphic-fetch', () => jest.fn())

const abortableNeverResolves = (url, { signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    reject(error)
  })
})

const jsonResponse = (status, body) => ({
  status,
  statusText: '',
  url: '',
  json: async () => body,
  text: async () => JSON.stringify(body)
})

beforeEach(() => {
  fetch.mockReset()
})

describe('fetchJSON', () => {
  it('rejects with a network error when the request times out', async () => {
    fetch.mockImplementation(abortableNeverResolves)

    const request = fetchJSON('/noo/graphql', { query: 'query Q { me { id } }' }, { method: 'post', host: 'http://localhost', timeout: 10 })

    await expect(request).rejects.toMatchObject({ isNetworkError: true })
    await expect(request).rejects.toThrow('timed out')
  })

  it('rejects with a network error when the network fails', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await fetchJSON('/noo/graphql', {}, { method: 'post', host: 'http://localhost' }).catch(e => e)

    expect(error.isNetworkError).toBe(true)
    expect(isTransientApiError(error)).toBe(true)
  })

  it('keeps the response status on server errors', async () => {
    fetch.mockResolvedValue(jsonResponse(503, { error: 'unavailable' }))

    const error = await fetchJSON('/noo/graphql', {}, { method: 'post', host: 'http://localhost' }).catch(e => e)

    expect(error.response.status).toBe(503)
    expect(isTransientApiError(error)).toBe(true)
  })

  it('sets no timeout unless one is asked for', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { data: {} }))

    await fetchJSON('/noo/graphql', { query: 'query Q { me { id } }' }, { method: 'post', host: 'http://localhost' })

    expect(fetch.mock.calls[0][1].signal).toBeUndefined()
  })

  it('resolves normally when the response arrives in time', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { data: { me: null } }))

    await expect(fetchJSON('/noo/graphql', {}, { method: 'post', host: 'http://localhost', timeout: 1000 }))
      .resolves.toEqual({ data: { me: null } })
  })
})

describe('isTransientApiError', () => {
  it('is false for client errors and missing errors', () => {
    expect(isTransientApiError(null)).toBe(false)
    expect(isTransientApiError({ response: { status: 401 } })).toBe(false)
    expect(isTransientApiError({ response: { status: 404 } })).toBe(false)
    expect(isTransientApiError(new Error('GraphQL error'))).toBe(false)
  })

  it('is true for a request that got no answer, even when it came back as a response', () => {
    expect(isTransientApiError({ response: { status: 0 } })).toBe(true)
    expect(isTransientApiError({ response: { status: 503 } })).toBe(true)
  })
})

describe('apiMiddleware', () => {
  const run = (api, meta) => {
    const next = jest.fn(action => action)
    apiMiddleware()({})(next)({ type: 'TEST', payload: { api }, meta })
    return fetch.mock.calls[0][1]
  }

  beforeEach(() => {
    fetch.mockResolvedValue(jsonResponse(200, { data: {} }))
  })

  it('times out a request that asks for a timeout', () => {
    const options = run({ path: '/noo/graphql', method: 'POST', params: { query: 'query CheckLogin { me { id } }' } }, { timeout: 1000 })
    expect(options.signal).toBeDefined()
  })

  it('lets every other request run as long as it takes', () => {
    const query = run({ path: '/noo/graphql', method: 'POST', params: { query: 'query fetchGroupRoleDetails { group { id } }' } })
    expect(query.signal).toBeUndefined()

    fetch.mockClear()
    const mutation = run({ path: '/noo/graphql', method: 'POST', params: { query: 'mutation ($id: ID) { deletePost(id: $id) { success } }' } })
    expect(mutation.signal).toBeUndefined()

    fetch.mockClear()
    const upload = run({ path: '/noo/upload', method: 'post', params: { url: 'https://example.com/a.png' } })
    expect(upload.signal).toBeUndefined()
  })
})

describe('checkLogin', () => {
  it('is the request that asks for the session-check timeout', () => {
    expect(checkLogin().meta.timeout).toBe(SESSION_CHECK_TIMEOUT_MS)
  })
})
