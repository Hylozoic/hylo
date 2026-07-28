import { createSelector } from 'reselect'
import {
  getAuthSessionAuthenticated,
  getAuthSessionEmailValidated,
  getAuthSessionHasRegistered,
  getAuthSessionSignupInProgress
} from './getAuthSession'

/*

Hylo Authentication and Authorization state reflected in terms of "Signup State"

  *Authentication*: We know who you are (you've validated your email)
  *Authorization*: You are allowed to access things

The state object and selectors below are primarily utilized for high-level routing
in `RootRouter`, `SignupRouter`, and `AuthRouter`.

This is the *derived/interpreted* layer over the raw `authSession` slice reads in
`getAuthSession`: those selectors return what's literally stored, while the
`SignupState` enum here collapses those facts into the user's position in the
signup funnel for routing.

Each state below below implies transition from the previous state has completed, e.g.:

  None > EmailValidation > Registration > SignupInProgress > Complete

*Some of this may be best consolidated into the `me` resolver, and/or `User` and
`Session` models, on the API side.*

*/

// ONLY use in the `SignupRouter` and in `getSignupState` below
export const SignupState = {
  None: 'None',
  EmailValidation: 'EmailValidation',
  Registration: 'Registration',
  SignupInProgress: 'SignupInProgress',
  Complete: 'Complete'
}

// Derived purely from the `authSession` slice so high-level routing
// (`getAuthorized`) never has to wait on the ORM `me` row. The signup-progress
// distinction (SignupInProgress vs Complete) lives in the separate
// `getSignupInProgress`/`getSignupComplete` selectors below, which are also
// session-driven (signupInProgress is mirrored into `authSession`).
export const getSignupState = createSelector(
  getAuthSessionAuthenticated,
  getAuthSessionEmailValidated,
  getAuthSessionHasRegistered,
  (isAuthenticated, emailValidated, hasRegistered) => {
    if (!isAuthenticated) return SignupState.None
    if (!emailValidated) return SignupState.EmailValidation
    if (!hasRegistered) return SignupState.Registration

    return SignupState.Complete
  }
)

// Authenticated = Current User Exists
// * Should probably only be used for attaching Hylo user to external
// APIs (i.e. Mixpanel currently) as soon as authentication is complete
export const getAuthenticated = createSelector(
  getAuthSessionAuthenticated,
  isAuthenticated => isAuthenticated
)

// Authenticated && email validated && registered (i.e. past signup).
// Derived from `authSession` only, so `RootRouter` can authorize without `me`.
// * Used by `RootRouter`
export const getAuthorized = createSelector(
  getSignupState,
  signupState => signupState === SignupState.Complete
)

// Authorized && signup wizard still in progress. Session-driven (signupInProgress is
// mirrored into `authSession` at auth time and on the wizard's `updateMe` confirm).
export const getSignupInProgress = createSelector(
  getAuthorized,
  getAuthSessionSignupInProgress,
  (authorized, signupInProgress) => authorized && !!signupInProgress
)

// Authorized && signup wizard finished. Session-driven (see `getSignupInProgress`).
export const getSignupComplete = createSelector(
  getAuthorized,
  getAuthSessionSignupInProgress,
  (authorized, signupInProgress) => authorized && !signupInProgress
)

export default getSignupState
