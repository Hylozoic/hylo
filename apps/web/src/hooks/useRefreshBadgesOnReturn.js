import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import checkForNewNotifications from 'store/actions/checkForNewNotifications'
import { refreshBadgeCounts } from 'util/badgeRefresh'

// Hidden this long, the tab has likely slept or lost its socket and missed
// the pushes that keep group badges current
export const LONG_ABSENCE_MS = 60 * 1000

/**
 * Refreshes badge counts when the tab becomes visible again: notifications
 * every time, and every group's unread count after a long absence.
 */
export default function useRefreshBadgesOnReturn () {
  const dispatch = useDispatch()

  useEffect(() => {
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (document.visibilityState !== 'visible') return
      const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      // The badge refetch includes the notification and thread counts
      if (hiddenFor > LONG_ABSENCE_MS && refreshBadgeCounts(dispatch)) return
      dispatch(checkForNewNotifications())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [dispatch])
}
