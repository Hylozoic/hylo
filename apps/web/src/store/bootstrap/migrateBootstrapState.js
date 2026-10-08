import { getInitialBootstrapState, BOOTSTRAP_VERSION } from 'store/reducers/bootstrap'

export function migrateBootstrapState (persistedState) {
  if (!persistedState) return persistedState

  const bootstrap = persistedState.bootstrap
  if (!bootstrap || bootstrap._version !== BOOTSTRAP_VERSION) {
    return {
      ...persistedState,
      bootstrap: getInitialBootstrapState()
    }
  }

  return persistedState
}
