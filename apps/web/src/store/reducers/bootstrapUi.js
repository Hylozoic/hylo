import { REMEMBER_REHYDRATED } from 'store/bootstrap/rememberConstants'
import { BOOTSTRAP_REPLAY_COMPLETE } from 'store/constants'

export function getInitialBootstrapUiState () {
  return {
    rehydrated: false,
    replayed: false
  }
}

export default function bootstrapUi (state = getInitialBootstrapUiState(), action) {
  if (action.type === REMEMBER_REHYDRATED) {
    return { ...state, rehydrated: true }
  }

  if (action.type === BOOTSTRAP_REPLAY_COMPLETE) {
    return { ...state, replayed: true }
  }

  return state
}
