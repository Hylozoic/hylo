import { createSelector } from 'reselect'

export const getBootstrap = state => state.bootstrap

export const getBootstrapUi = state => state.bootstrapUi

export const getBootstrapRehydrated = createSelector(
  getBootstrapUi,
  bootstrapUi => bootstrapUi.rehydrated
)

export const getBootstrapReplayed = createSelector(
  getBootstrapUi,
  bootstrapUi => bootstrapUi.replayed
)

export const getBootstrappedFromCheckLogin = createSelector(
  getBootstrapUi,
  bootstrapUi => bootstrapUi.bootstrappedFromCheckLogin
)

// MeQuery payload is what drives nav/memberships on cold boot.
export const hasBootstrapCache = createSelector(
  getBootstrap,
  bootstrap => !!bootstrap?.currentUser?.data?.me
)
