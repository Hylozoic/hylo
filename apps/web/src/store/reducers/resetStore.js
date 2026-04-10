import { pick } from 'lodash/fp'
import { getEmptyState } from '..'
import { LOGOUT, RESET_STORE } from '../constants'

export const KEYS_PRESERVED_ON_RESET = [
  'pending',
  'locationHistory',
  'mixpanel',
  // Preserve redux-persist's internal state machine metadata so it doesn't
  // trigger a redundant re-hydration cycle after a store reset. The ORM data
  // itself is cleared by getEmptyState(); persist's subscriber will then save
  // that empty state to storage so the next load starts fresh.
  '_persist'
]

export default function (state = null, action) {
  if (action.type === LOGOUT && !action.error) {
    return {
      ...getEmptyState(),
      _persist: state?._persist
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
