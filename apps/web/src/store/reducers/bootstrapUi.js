import { REMEMBER_REHYDRATED } from 'store/bootstrap/rememberConstants'
import { BOOTSTRAP_REPLAY_COMPLETE, FETCH_FOR_CURRENT_USER } from 'store/constants'

export function getInitialBootstrapUiState () {
  return {
    rehydrated: false,
    replayed: false,
    bootstrappedFromCheckLogin: false
  }
}

export default function bootstrapUi (state = getInitialBootstrapUiState(), action) {
  if (action.type === REMEMBER_REHYDRATED) {
    return { ...state, rehydrated: true }
  }

  if (action.type === BOOTSTRAP_REPLAY_COMPLETE) {
    return { ...state, replayed: true }
  }

  if (action.type === FETCH_FOR_CURRENT_USER && action.meta?.fromCheckLoginFanOut) {
    return { ...state, bootstrappedFromCheckLogin: true }
  }

  return state
}
