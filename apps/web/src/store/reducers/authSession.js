import { CHECK_LOGIN, CLEAR_AUTH_SESSION, LOGIN, LOGOUT, SET_AUTH_SESSION } from 'store/constants'
import { REGISTER, VERIFY_EMAIL } from 'routes/NonAuthLayoutRouter/Signup/Signup.store'

export const AuthSessionStatus = {
  Unknown: 'unknown',
  Anonymous: 'anonymous',
  Authenticated: 'authenticated'
}

export const getInitialAuthSessionState = () => ({
  status: AuthSessionStatus.Unknown,
  userId: null,
  checkedAt: null
})

export default function authSession (state = getInitialAuthSessionState(), action) {
  // Email/password (and GraphQL login mutation): payload.data.login.me
  // Social `loginWithService` also uses type LOGIN but resolves with no GraphQL body —
  // leave state unchanged so a later `checkLogin()` establishes the session.
  if (action.type === LOGIN) {
    if (action.error) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    const login = action?.payload?.data?.login
    if (login === undefined) return state

    if (login.error) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    const me = login.me
    if (!me) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    return {
      status: AuthSessionStatus.Authenticated,
      userId: me.id,
      checkedAt: Date.now()
    }
  }

  // Signup: session + Me come back on these mutations (same as checkLogin for cookie)
  if (action.type === VERIFY_EMAIL) {
    if (action.error) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    const verifyEmail = action?.payload?.data?.verifyEmail
    if (!action?.payload?.data) return state

    if (verifyEmail?.error || !verifyEmail?.me) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    return {
      status: AuthSessionStatus.Authenticated,
      userId: verifyEmail.me.id,
      checkedAt: Date.now()
    }
  }

  if (action.type === REGISTER) {
    if (action.error) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    const register = action?.payload?.data?.register
    if (!action?.payload?.data) return state

    const me = register?.me
    if (!me) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    return {
      status: AuthSessionStatus.Authenticated,
      userId: me.id,
      checkedAt: Date.now()
    }
  }

  if (action.type === CHECK_LOGIN) {
    if (action.error) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    const me = action?.payload?.data?.me
    if (!action?.payload?.data) return state

    if (!me) {
      return {
        status: AuthSessionStatus.Anonymous,
        userId: null,
        checkedAt: Date.now()
      }
    }

    return {
      status: AuthSessionStatus.Authenticated,
      userId: me.id,
      checkedAt: Date.now()
    }
  }

  if (action.type === LOGOUT || action.type === CLEAR_AUTH_SESSION) {
    return {
      status: AuthSessionStatus.Anonymous,
      userId: null,
      checkedAt: Date.now()
    }
  }

  if (action.type === SET_AUTH_SESSION) {
    return { ...state, ...action.payload }
  }

  return state
}
