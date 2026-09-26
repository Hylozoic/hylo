import fetchBadgeCounts from 'store/actions/fetchBadgeCounts'

export const BADGE_REFRESH_MIN_INTERVAL_MS = 30 * 1000

let lastRefreshAt = null

/**
 * Refetches the nav badge counts at most once per interval: waking from
 * sleep and the socket reconnecting usually happen together. Returns whether
 * a refetch was dispatched.
 */
export function refreshBadgeCounts (dispatch, now = Date.now()) {
  if (lastRefreshAt !== null && now - lastRefreshAt < BADGE_REFRESH_MIN_INTERVAL_MS) return false
  lastRefreshAt = now
  dispatch(fetchBadgeCounts())
  return true
}
