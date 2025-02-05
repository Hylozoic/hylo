import { pick } from 'lodash/fp'
import { getEmptyState } from 'store'
import { LOGOUT, RESET_STORE } from '../constants'

export const KEYS_PRESERVED_ON_LOGOUT = [
  'initialURL'
]

export const KEYS_PRESERVED_ON_RESET = []

export default function (state = null, action) {
  if (action.type === LOGOUT && !action.error) {
    return {
      ...getEmptyState(),
      ...pick(KEYS_PRESERVED_ON_LOGOUT, state)
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
