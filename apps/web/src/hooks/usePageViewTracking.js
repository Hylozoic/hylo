import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AnalyticsEvents } from '@hylo/shared'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { getAuthSessionUnknown } from 'store/selectors/getAuthSession'
import { getAuthenticated } from 'store/selectors/getSignupState'
import getMe from 'store/selectors/getMe'
import { hasEmailClickParams } from 'hooks/useEmailClickthrough'
import { getCookieConsent } from 'util/cookieConsent'
import { pageViewReferrers, resolveAnalyticsChoice } from 'util/analytics'
import routePattern from 'util/routePattern'

// A page shown for less than this (a redirect on the way somewhere) isn't counted
export const PAGE_VIEW_SETTLE_MS = 300

const getMyCookieConsentPreferences = state => getMe(state)?.cookieConsentPreferences

/**
 * Sends "Page Viewed" with the route pattern (never the address itself) each
 * time the page changes. It goes through trackAnalyticsEvent, so
 * mixpanelMiddleware's checks apply: nothing is sent when analytics were
 * rejected, in the sandbox demo or without a Mixpanel token.
 *
 * It waits until the session is known, so the view is credited to the
 * signed-in person; while a signed-in person's analytics choice is still
 * unknown (no cookie in this browser, and their account's choice not loaded
 * yet); and while an email link's tags are still in the address, because
 * useEmailClickthrough removes them first. Mixpanel adds addresses to every
 * event, so $current_url is set to the pattern and the referrers to their host.
 */
export default function usePageViewTracking () {
  const dispatch = useDispatch()
  const { pathname, search } = useLocation()
  const sessionUnknown = useSelector(getAuthSessionUnknown)
  const isLoggedIn = useSelector(getAuthenticated)
  // Only this field, so other updates to Me don't re-render RootRouter
  const accountPreferences = useSelector(getMyCookieConsentPreferences)
  const waitingForEmailTags = hasEmailClickParams(search)
  const lastCounted = useRef(null)

  useEffect(() => {
    if (sessionUnknown || waitingForEmailTags || lastCounted.current === pathname) return

    // Runs again when the account's choice loads (accountPreferences below)
    const choice = resolveAnalyticsChoice(getCookieConsent(), isLoggedIn ? accountPreferences : null)
    if (choice === undefined || choice === false) return

    const timer = setTimeout(() => {
      lastCounted.current = pathname
      const route = routePattern(pathname)
      dispatch(trackAnalyticsEvent(AnalyticsEvents.PAGE_VIEWED, {
        route,
        $current_url: `${window.location.origin}${route}`,
        ...pageViewReferrers()
      }))
    }, PAGE_VIEW_SETTLE_MS)

    return () => clearTimeout(timer)
  }, [pathname, sessionUnknown, waitingForEmailTags, isLoggedIn, accountPreferences])
}
