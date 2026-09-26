import fetch from 'isomorphic-fetch'
import apiMiddleware, { fetchJSON, isTransientApiError } from './apiMiddleware'

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
})

describe('apiMiddleware', () => {
  const run = api => {
    const next = jest.fn(action => action)
    apiMiddleware()({})(next)({ type: 'TEST', payload: { api } })
    return fetch.mock.calls[0][1]
  }

  beforeEach(() => {
    fetch.mockResolvedValue(jsonResponse(200, { data: {} }))
  })

  it('times out GraphQL queries', () => {
    const options = run({ path: '/noo/graphql', method: 'POST', params: { query: 'query CheckLogin { me { id } }' } })
    expect(options.signal).toBeDefined()
  })

  it('never abandons GraphQL mutations or other writes', () => {
    const mutation = run({ path: '/noo/graphql', method: 'POST', params: { query: 'mutation ($id: ID) { deletePost(id: $id) { success } }' } })
    expect(mutation.signal).toBeUndefined()

    fetch.mockClear()
    const upload = run({ path: '/noo/upload', method: 'post', params: { url: 'https://example.com/a.png' } })
    expect(upload.signal).toBeUndefined()
  })
})
