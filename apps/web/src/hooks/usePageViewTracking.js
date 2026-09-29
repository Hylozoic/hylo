import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AnalyticsEvents } from '@hylo/shared'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { getAuthSessionUnknown } from 'store/selectors/getAuthSession'
import { hasEmailClickParams } from 'hooks/useEmailClickthrough'
import routePattern from 'util/routePattern'

// A page shown for less than this (a redirect on the way somewhere) isn't counted
export const PAGE_VIEW_SETTLE_MS = 300

/**
 * Sends "Page Viewed" with the route pattern (never the address itself) each
 * time the page changes. It goes through trackAnalyticsEvent, so
 * mixpanelMiddleware's checks apply: nothing is sent when analytics were
 * rejected, in the sandbox demo or without a Mixpanel token.
 *
 * It waits until the session is known, so the view is credited to the
 * signed-in person, and while an email link's tags are still in the address,
 * because useEmailClickthrough removes them first. Mixpanel adds the page's
 * address to every event, so $current_url is set to the pattern too.
 */
export default function usePageViewTracking () {
  const dispatch = useDispatch()
  const { pathname, search } = useLocation()
  const sessionUnknown = useSelector(getAuthSessionUnknown)
  const waitingForEmailTags = hasEmailClickParams(search)
  const lastCounted = useRef(null)

  useEffect(() => {
    if (sessionUnknown || waitingForEmailTags || lastCounted.current === pathname) return

    const timer = setTimeout(() => {
      lastCounted.current = pathname
      const route = routePattern(pathname)
      dispatch(trackAnalyticsEvent(AnalyticsEvents.PAGE_VIEWED, {
        route,
        $current_url: `${window.location.origin}${route}`
      }))
    }, PAGE_VIEW_SETTLE_MS)

    return () => clearTimeout(timer)
  }, [pathname, sessionUnknown, waitingForEmailTags])
}
