import isBrowserNetworkError, {
  browserNetworkErrorIgnorePatterns,
  isBrowserNetworkErrorMessage
} from './isBrowserNetworkError'

describe('isBrowserNetworkError', () => {
  it('matches browser fetch transport failures', () => {
    expect(isBrowserNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isBrowserNetworkError(new TypeError('Load failed'))).toBe(true)
    expect(isBrowserNetworkError(Object.assign(new Error('NetworkError when attempting to fetch resource.'), { name: 'NetworkError' }))).toBe(true)
    const aborted = new Error('The user aborted a request.')
    aborted.name = 'AbortError'
    expect(isBrowserNetworkError(aborted)).toBe(true)
  })

  it('matches a host suffix some browsers append', () => {
    expect(isBrowserNetworkError(new TypeError('Failed to fetch (www.hylo.com)'))).toBe(true)
  })

  it('keeps HTTP and application errors', () => {
    const httpError = new TypeError('Failed to fetch')
    httpError.response = { status: 500, body: 'nope' }
    expect(isBrowserNetworkError(httpError)).toBe(false)
    expect(isBrowserNetworkError(new Error('Failed to fetch stats'))).toBe(false)
    expect(isBrowserNetworkError(new TypeError('Failed to fetch dynamically imported module'))).toBe(false)
    expect(isBrowserNetworkError(new Error('Unexpected error.'))).toBe(false)
    expect(isBrowserNetworkErrorMessage('Failed to fetch stats')).toBe(false)
  })
})

describe('browserNetworkErrorIgnorePatterns', () => {
  const patterns = browserNetworkErrorIgnorePatterns()

  function matches (message) {
    return patterns.some(pattern => pattern.test(message))
  }

  it('drops the raw fetch error and the redux action wrapper', () => {
    expect(matches('Failed to fetch')).toBe(true)
    expect(matches('TypeError: Failed to fetch')).toBe(true)
    expect(matches('action error for FETCH_VIEW_PINNED_POSTS: Failed to fetch')).toBe(true)
    expect(matches('action error for FETCH_DRAFT: Failed to fetch (www.hylo.com)')).toBe(true)
  })

  it('keeps application messages that merely contain the words', () => {
    expect(matches('Failed to fetch stats')).toBe(false)
    expect(matches('Failed to fetch dynamically imported module')).toBe(false)
    expect(matches('action error for FETCH_THREADS: Unexpected error. | path: me.messageThreads')).toBe(false)
  })
})
