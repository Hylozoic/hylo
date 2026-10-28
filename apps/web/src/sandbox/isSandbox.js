export const SANDBOX_BASENAME = '/sandbox'

/** Window event fired by the sandbox transport after a successful mutation */
export const SANDBOX_MUTATION_EVENT = 'hylo:sandbox-mutation'

/**
 * True when the current page is the sandbox demo (path prefix /sandbox).
 * Evaluated from window.location so it is available at store-creation time.
 */
export function isSandboxMode () {
  if (typeof window === 'undefined') return false
  const { pathname } = window.location
  return pathname === SANDBOX_BASENAME || pathname.startsWith(`${SANDBOX_BASENAME}/`)
}
