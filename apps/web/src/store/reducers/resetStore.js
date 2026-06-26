import { pick } from 'lodash/fp'
import { getEmptyState } from '..'
import { LOGOUT, RESET_STORE } from '../constants'

export const KEYS_PRESERVED_ON_RESET = [
  'pending',
  'locationHistory',
  'mixpanel'
]

export default function (state = null, action) {
  if (action.type === LOGOUT && !action.error) {
    // Wipe all cached data, but keep the anonymous `authSession` the slice already
    // computed for this LOGOUT (getEmptyState would reset it to `Unknown`, making the
    // app re-run checkLogin instead of treating the user as definitively logged out).
    return {
      ...getEmptyState(),
      authSession: state.authSession
    }
  }

  if (action.type === RESET_STORE && !action.error) {
    return {
      ...getEmptyState(),
      ...pick(KEYS_PRESERVED_ON_RESET, state)
    }
  }

  return state
}
