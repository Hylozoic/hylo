import { useCallback, useEffect, useRef } from 'react'
import { getSocket } from 'client/websockets'

// One return to the page usually fires several of the signals below at once
// (visibilitychange, focus and a socket reconnect), so calls this close together
// collapse into a single refresh
export const REFRESH_ON_RETURN_THROTTLE_MS = 2000

// Glancing at another window and straight back can't have cost us any socket
// events (a connection only drops after ~25s without pings, and that is caught
// by the reconnect trigger), so only refresh on return after a longer absence
export const REFRESH_ON_RETURN_MIN_AWAY_MS = 5000

/**
 * Calls `refresh` whenever the page may have missed realtime updates:
 * - the page becomes visible again (tab switch, or the mobile app returning to the
 *   foreground — e.g. after tapping a push notification), or the window regains
 *   focus, after being away for at least REFRESH_ON_RETURN_MIN_AWAY_MS
 * - the socket (re)connects. Socket events emitted while it was disconnected — as it
 *   is while the mobile app sits in the background — are never replayed.
 *
 * Returns a throttled `refreshNow` for callers that have their own reasons to
 * refresh (e.g. navigating to the page that's already open).
 * The caller is expected to fetch on mount, so triggers in the first
 * REFRESH_ON_RETURN_THROTTLE_MS after mounting are ignored.
 */
export default function useRefreshOnReturn (refresh, {
  enabled = true,
  throttleMs = REFRESH_ON_RETURN_THROTTLE_MS,
  minAwayMs = REFRESH_ON_RETURN_MIN_AWAY_MS
} = {}) {
  const refreshRef = useRef(refresh)
  const lastRefreshRef = useRef(Date.now())

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  const refreshNow = useCallback(() => {
    if (!enabled) return
    const now = Date.now()
    if (now - lastRefreshRef.current < throttleMs) return
    lastRefreshRef.current = now
    refreshRef.current()
  }, [enabled, throttleMs])

  useEffect(() => {
    if (!enabled) return undefined

    // When the page was left. Unknown (null) if no blur/hidden event was seen —
    // some WebViews freeze without one — in which case a return always refreshes
    let awaySince = null
    const markAway = () => {
      if (awaySince === null) awaySince = Date.now()
    }
    const handleReturn = () => {
      const wasAwayLongEnough = awaySince === null || Date.now() - awaySince >= minAwayMs
      awaySince = null
      if (wasAwayLongEnough) refreshNow()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleReturn()
      else markAway()
    }

    window.addEventListener('blur', markAway)
    window.addEventListener('focus', handleReturn)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const socket = getSocket()
    const canListen = socket && typeof socket.on === 'function'
    if (canListen) {
      // 'connect' fires on every reconnection; 'reconnect' is kept for parity with
      // SocketSubscriber and is de-duplicated by the throttle
      socket.on('connect', refreshNow)
      socket.on('reconnect', refreshNow)
    }

    return () => {
      window.removeEventListener('blur', markAway)
      window.removeEventListener('focus', handleReturn)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (canListen && typeof socket.off === 'function') {
        socket.off('connect', refreshNow)
        socket.off('reconnect', refreshNow)
      }
    }
  }, [enabled, minAwayMs, refreshNow])

  return refreshNow
}
