import { CHECK_LOGIN, CLEAR_AUTH_SESSION, LOGIN, LOGOUT, SET_AUTH_SESSION, UPDATE_USER_SETTINGS } from 'store/constants'
import { REGISTER, VERIFY_EMAIL } from 'routes/NonAuthLayoutRouter/Signup/Signup.store'

export const AuthSessionStatus = {
  Unknown: 'unknown',
  Anonymous: 'anonymous',
  Authenticated: 'authenticated'
}

export const getInitialAuthSessionState = () => ({
  status: AuthSessionStatus.Unknown,
  userId: null,
  // `emailValidated`, `hasRegistered`, and `signupInProgress` are the only `me` facts
  // needed to decide authorization and signup state. Holding them here keeps
  // `getAuthState`/`getAuthorized`/`getSignup*` independent of the ORM `me` row (and
  // persistable) while rich user data stays in the ORM.
  emailValidated: null,
  hasRegistered: null,
  signupInProgress: null,
  checkedAt: null
})

// Authenticated session derived from the `me` returned by an auth action.
const authenticatedSession = me => ({
  status: AuthSessionStatus.Authenticated,
  userId: me.id,
  emailValidated: me.emailValidated ?? null,
  hasRegistered: me.hasRegistered ?? null,
  signupInProgress: me.settings?.signupInProgress ?? null,
  checkedAt: Date.now()
})

const anonymousSession = () => ({
  status: AuthSessionStatus.Anonymous,
  userId: null,
  emailValidated: null,
  hasRegistered: null,
  signupInProgress: null,
  checkedAt: Date.now()
})

export default function authSession (state = getInitialAuthSessionState(), action) {
  // Email/password (and GraphQL login mutation): payload.data.login.me
  // Social `loginWithService` also uses type LOGIN but resolves with no GraphQL body —
  // leave state unchanged so a later `checkLogin()` establishes the session.
  if (action.type === LOGIN) {
    if (action.error) {
      return anonymousSession()
    }

    const login = action?.payload?.data?.login
    if (login === undefined) return state

    if (login.error) {
      return anonymousSession()
    }

    const me = login.me
    if (!me) {
      return anonymousSession()
    }

    return authenticatedSession(me)
  }

  // Signup: session + Me come back on these mutations (same as checkLogin for cookie)
  if (action.type === VERIFY_EMAIL) {
    if (action.error) {
      return anonymousSession()
    }

    const verifyEmail = action?.payload?.data?.verifyEmail
    if (!action?.payload?.data) return state

    if (verifyEmail?.error || !verifyEmail?.me) {
      return anonymousSession()
    }

    return authenticatedSession(verifyEmail.me)
  }

  if (action.type === REGISTER) {
    if (action.error) {
      return anonymousSession()
    }

    const register = action?.payload?.data?.register
    if (!action?.payload?.data) return state

    const me = register?.me
    if (!me) {
      return anonymousSession()
    }

    return authenticatedSession(me)
  }

  if (action.type === CHECK_LOGIN) {
    if (action.error) {
      return anonymousSession()
    }

    const me = action?.payload?.data?.me
    if (!action?.payload?.data) return state

    if (!me) {
      return anonymousSession()
    }

    return authenticatedSession(me)
  }

  if (action.type === LOGOUT || action.type === CLEAR_AUTH_SESSION) {
    return anonymousSession()
  }

  // The welcome wizard flips `settings.signupInProgress` via `updateMe`. Mirror the
  // server-confirmed value (and any auth facts that came back) into the session so the
  // signup selectors stay session-driven. Handled on the confirmed action only — the
  // optimistic `_PENDING` ORM flip is intentionally not mirrored here.
  if (action.type === UPDATE_USER_SETTINGS && !action.error) {
    const me = action?.payload?.data?.updateMe
    if (!me) return state
    return {
      ...state,
      emailValidated: me.emailValidated ?? state.emailValidated,
      hasRegistered: me.hasRegistered ?? state.hasRegistered,
      signupInProgress: me.settings?.signupInProgress ?? null
    }
  }

  if (action.type === SET_AUTH_SESSION) {
    return { ...state, ...action.payload }
  }

  return state
}
