import errorReporter from 'client/errorReporter'
import errorReporterMiddleware, {
  describeActionError,
  safeStringify
} from './errorReporterMiddleware'

jest.mock('client/errorReporter', () => ({
  __esModule: true,
  default: { error: jest.fn() },
  addBreadcrumb: jest.fn(),
  SENTRY_DEBUG: false
}))

describe('describeActionError', () => {
  it('includes GraphQL message and path from Error-shaped payloads', () => {
    const payload = Object.assign(new Error('Unexpected error.'), {
      path: ['me', 'messageThreads'],
      locations: [{ line: 2, column: 3 }]
    })

    expect(describeActionError('FETCH_THREADS', payload)).toEqual(
      'action error for FETCH_THREADS: Unexpected error. | path: me.messageThreads'
    )
  })

  it('includes HTTP response body without duplicating matching Error.message', () => {
    const body = '{"errors":[{"message":"Unexpected error.","extensions":{}}]}'
    const payload = new Error(body)
    payload.response = { status: 500, body }

    expect(describeActionError('FETCH_THREADS', payload)).toEqual(
      `action error for FETCH_THREADS: ${body}`
    )
  })

  it('falls back to type-only when payload has no useful detail', () => {
    expect(describeActionError('FETCH_GROUP_DETAILS', {})).toEqual(
      'action error for FETCH_GROUP_DETAILS'
    )
  })
})

describe('safeStringify', () => {
  it('keeps Error message/name and enumerable GraphQL fields', () => {
    const err = Object.assign(new Error('Unexpected error.'), {
      path: ['group'],
      locations: [{ line: 1, column: 1 }]
    })
    const parsed = JSON.parse(safeStringify({ error: true, payload: err, type: 'FETCH_GROUP_DETAILS' }))

    expect(parsed.payload.message).toEqual('Unexpected error.')
    expect(parsed.payload.name).toEqual('Error')
    expect(parsed.payload.path).toEqual(['group'])
    expect(parsed.payload.locations).toEqual([{ line: 1, column: 1 }])
  })
})

describe('errorReporterMiddleware', () => {
  it('reports a diagnosable message for GraphQL action errors', () => {
    const next = jest.fn(action => action)
    const payload = Object.assign(new Error('Unexpected error.'), {
      path: ['group']
    })
    const action = { error: true, type: 'FETCH_GROUP_DETAILS', payload }

    errorReporterMiddleware({})(next)(action)

    expect(errorReporter.error).toHaveBeenCalledWith(
      'action error for FETCH_GROUP_DETAILS: Unexpected error. | path: group',
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'FETCH_GROUP_DETAILS',
          payload: expect.objectContaining({
            message: 'Unexpected error.',
            path: ['group']
          })
        })
      })
    )
    expect(next).toHaveBeenCalledWith(action)
  })
})
