import { createSelector } from 'reselect'
import { AuthSessionStatus } from 'store/reducers/authSession'

export const getAuthSession = state => state.authSession

export const getAuthSessionStatus = createSelector(
  getAuthSession,
  authSession => authSession.status
)

export const getAuthSessionAuthenticated = createSelector(
  getAuthSessionStatus,
  authSessionStatus => authSessionStatus === AuthSessionStatus.Authenticated
)

export const getAuthSessionUnknown = createSelector(
  getAuthSessionStatus,
  authSessionStatus => authSessionStatus === AuthSessionStatus.Unknown
)
