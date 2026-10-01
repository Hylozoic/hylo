import { reconnectSocket } from 'client/websockets'
import { LOGIN } from '../constants'
import socketReconnectMiddleware from './socketReconnectMiddleware'

jest.mock('client/websockets', () => ({
  reconnectSocket: jest.fn()
}))

describe('socketReconnectMiddleware', () => {
  const next = jest.fn(action => action)
  const run = action => socketReconnectMiddleware({})(next)(action)

  beforeEach(() => {
    reconnectSocket.mockClear()
    next.mockClear()
  })

  it('reconnects the socket after a successful login', () => {
    const action = { type: LOGIN, payload: { data: {} } }
    expect(run(action)).toBe(action)
    expect(next).toHaveBeenCalledWith(action)
    expect(reconnectSocket).toHaveBeenCalledTimes(1)
  })

  it('does not reconnect while the login is pending or when it fails', () => {
    run({ type: LOGIN, payload: Promise.resolve() })
    run({ type: LOGIN, error: true, payload: new Error('nope') })
    expect(reconnectSocket).not.toHaveBeenCalled()
  })

  it('ignores other actions', () => {
    run({ type: 'SOMETHING_ELSE', payload: {} })
    expect(reconnectSocket).not.toHaveBeenCalled()
  })
})
