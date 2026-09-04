import { useEffect } from 'react'

const handlers = new Set()

/**
 * Register a handler for Android hardware back (v2 mobile WebView only).
 * Handlers run in reverse registration order (most recently mounted first).
 * Return true if the back press was consumed.
 */
export function registerHardwareBackHandler (handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function runRegisteredHardwareBackHandlers () {
  const list = Array.from(handlers).reverse()
  for (const handler of list) {
    if (handler()) return true
  }
  return false
}

/**
 * Mount-scoped registration for overlay components (CreateModal, PostDialog, etc.)
 */
export function useRegisterHardwareBackHandler (handler) {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.HyloMobileV2) return
    return registerHardwareBackHandler(handler)
  }, [handler])
}
