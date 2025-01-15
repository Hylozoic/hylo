import { useMemo } from 'react'
import { useQuery } from 'urql'
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

export function getAuthState (currentUser) {
  if (!currentUser) return AuthState.None

  const { emailValidated, hasRegistered, settings } = currentUser
  const { signupInProgress } = settings

  if (!emailValidated) return AuthState.EmailValidation
  if (!hasRegistered) return AuthState.Registration
  if (signupInProgress) return AuthState.SignupInProgress

  return AuthState.Complete
}

export default function useAuthState (useQueryOptions = {}) {
  const [{ data, fetching, error }, checkAuth] = useQuery({
    // TODO: URQL - Will always make a request after cache retrieval, may be unnecessary
    requestPolicy: 'cache-and-network',
    ...useQueryOptions,
    query: meCheckAuthQuery
  })
  const currentUser = data?.me
  const authState = useMemo(() => getAuthState(currentUser), [currentUser])

  // Authenticated = Current User Exists
  // * Should probably only be used for attaching Hylo user to external
  // APIs (i.e. Mixpanel currently) as soon as authentication is complete
  const isAuthenticated = useMemo(() => !fetching &&
    (authState !== AuthState.None)
  , [fetching, authState])

  // Authenticated && (Signup In Progress || Signup Complete)
  // * Used by `RootRouter`
  const isAuthorized = useMemo(() => !fetching && [
    // NOTE: Unlike Web the InProgress state is handled before being considered fully authorized
    // AuthState.SignupInProgress,
    AuthState.Complete
  ].includes(authState), [fetching, authState])

  // Authenticated && Authorized && Signup In Progress
  const isSignupInProgress = useMemo(() => !fetching &&
    authState === AuthState.SignupInProgress
  , [fetching, authState])

  // Authenticated && Authorized && Signup Complete
  const isSignupComplete = useMemo(() => !fetching &&
    authState === AuthState.Complete
  , [fetching, authState])

  return [
    {
      fetching,
      authState,
      isAuthenticated,
      isAuthorized,
      isSignupInProgress,
      isSignupComplete
    },
    checkAuth
  ]
}
