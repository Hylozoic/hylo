import { CHECK_LOGIN } from 'store/constants'
import authSession, { AuthSessionStatus, getInitialAuthSessionState } from './authSession'

const serverError = status => {
  const error = new Error('Server error')
  error.response = { status }
  return error
}

const networkError = () => {
  const error = new Error('Failed to fetch')
  error.isNetworkError = true
  return error
}

const checkLoginFailed = error => ({ type: CHECK_LOGIN, error: true, payload: error })

describe('authSession CHECK_LOGIN', () => {
  it('keeps the session unknown and flags a transient error on a 5xx', () => {
    const state = authSession(getInitialAuthSessionState(), checkLoginFailed(serverError(503)))
    expect(state.status).toBe(AuthSessionStatus.Unknown)
    expect(state.transientError).toBe(true)
  })

  it('keeps the session unknown and flags a transient error when the network fails', () => {
    const state = authSession(getInitialAuthSessionState(), checkLoginFailed(networkError()))
    expect(state.status).toBe(AuthSessionStatus.Unknown)
    expect(state.transientError).toBe(true)
  })

  it('treats a 401 or 403 as signed out', () => {
    [401, 403].forEach(status => {
      const state = authSession(getInitialAuthSessionState(), checkLoginFailed(serverError(status)))
      expect(state.status).toBe(AuthSessionStatus.Anonymous)
      expect(state.transientError).toBe(false)
    })
  })

  it('treats a null me as signed out', () => {
    const state = authSession(getInitialAuthSessionState(), {
      type: CHECK_LOGIN,
      payload: { data: { me: null } }
    })
    expect(state.status).toBe(AuthSessionStatus.Anonymous)
    expect(state.transientError).toBe(false)
  })

  it('clears the transient error once the session is known', () => {
    const failed = authSession(getInitialAuthSessionState(), checkLoginFailed(serverError(502)))
    const state = authSession(failed, {
      type: CHECK_LOGIN,
      payload: { data: { me: { id: '1', emailValidated: true, hasRegistered: true, settings: {} } } }
    })
    expect(state.status).toBe(AuthSessionStatus.Authenticated)
    expect(state.transientError).toBe(false)
  })

  it('does not sign out an established session on a transient error', () => {
    const authenticated = authSession(getInitialAuthSessionState(), {
      type: CHECK_LOGIN,
      payload: { data: { me: { id: '1', settings: {} } } }
    })
    const state = authSession(authenticated, checkLoginFailed(networkError()))
    expect(state).toBe(authenticated)
  })
})
