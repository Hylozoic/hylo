const KEY = 'hylo_anonymous_id'

/** A stable id for this browser, used to attach logged-out events after signup. */
export function getAnonymousId () {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const existing = window.localStorage.getItem(KEY)
  if (existing) return existing
  const created = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(KEY, created)
  return created
}
