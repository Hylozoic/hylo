import { useMemo } from 'react'
import { useClient, useQuery } from 'urql'
import meCheckAuthQuery from 'graphql/queries/meCheckAuthQuery'

/*

Hylo Authentication and Authorization state reflected in terms of "Signup State"

  *Authentication*: We know who you are (you've validated your email)
  *Authorization*: You are allowed to access things

The state object and selectors below are primarily utilized for high-level routing
in `RootRouter`, `SignupRouter`, and `AuthRouter`.

Each state below below implies transition from the previous state has completed, e.g.:

  None > EmailValidation > Registration > SignupInProgress > Complete

*Some of this may be best consolidated into the `me` resolver, and/or `User` and
`Session` models, on the API side.*

*/

// ONLY use in the `SignupRouter` and in `getAuthState` below
export const AuthState = {
  None: 'None',
  EmailValidation: 'EmailValidation',
  Registration: 'Registration',
  SignupInProgress: 'SignupInProgress',
  Complete: 'Complete'
}

// TODO: getAuthState and getAuthStatus could and probably should be merged into a single function
// to make this a little easier to grok

function getAuthState (currentUser) {
  if (!currentUser) return AuthState.None

  const { emailValidated, hasRegistered, settings } = currentUser
  const { signupInProgress } = settings

  if (!emailValidated) return AuthState.EmailValidation
  if (!hasRegistered) return AuthState.Registration
  if (signupInProgress) return AuthState.SignupInProgress

  return AuthState.Complete
}

export function getAuthStatuses (currentUser) {
  const authState = getAuthState(currentUser)

  return {
    // Authenticated = Current User Exists
    // * Should probably only be used for attaching Hylo user to external
    // APIs (i.e. Mixpanel currently) as soon as authentication is complete
    isAuthenticated: authState !== AuthState.None,

    // Authenticated && (Signup In Progress || Signup Complete)
    // * Used by `RootRouter`
    isAuthorized: [
      AuthState.Complete
      // NOTE: Unlike Web the InProgress state is handled before being considered fully authorized
      // AuthState.SignupInProgress,
    ].includes(authState),

    // Authenticated && Authorized && Signup In Progress
    isSignupInProgress: authState === AuthState.SignupInProgress,

    // Authenticated && Authorized && Signup Complete
    isSignupComplete: authState === AuthState.Complete,

    authState
  }
}

export default function useAuthStatus (useQueryOptions = {}) {
  const [{ data, fetching, error }, checkAuth] = useQuery({
    // TODO: URQL - Will always make a request after cache retrieval, may be unnecessary
    requestPolicy: 'cache-and-network',
    ...useQueryOptions,
    query: meCheckAuthQuery
  })
  const currentUser = data?.me
  const authStatuses = useMemo(() => getAuthStatuses(currentUser), [currentUser])

  return [{ ...authStatuses, error, fetching }, checkAuth]
}
