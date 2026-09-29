import { get, isString, isObject, omit } from 'lodash/fp'
import mixpanel from 'mixpanel-browser'
import { getAuthenticated } from '../selectors/getSignupState'
import getMe from '../selectors/getMe'
import { getCookieConsent } from 'util/cookieConsent'
import { identifyAnalytics, resolveAnalyticsChoice } from 'util/analytics'
import { isSandboxMode } from 'sandbox/isSandbox'

export default function mixpanelMiddleware (store) {
  return next => action => {
    const { error, type, meta } = action

    if (!error && !type.match(/_PENDING$/) && meta && meta.analytics) {
      // meta.analytics can be either simply true, a string (name of event) or a hash
      // with data that will be attached to the event sent to mixpanel (eventName being
      // a required key).
      const state = store.getState()

      if (isSandboxMode()) return next(action)

      if (!import.meta.env.VITE_MIXPANEL_TOKEN || !mixpanel) return next(action)

      // Cookie consent check: nothing is sent after a rejection, or for a
      // signed-in person without the cookie until their account's choice has
      // loaded on the Me row (CheckLogin and MeQuery load it). Signed out,
      // there is no account, so no cookie means not answered.
      const isLoggedIn = getAuthenticated(state)
      const me = isLoggedIn ? getMe(state) : null
      const choice = resolveAnalyticsChoice(getCookieConsent(), isLoggedIn ? me?.cookieConsentPreferences : null)
      if (choice === undefined || choice === false) return next(action)

      const { analytics } = meta
      const trackingEventName = get('eventName', analytics) ||
        (isString(analytics) && analytics) ||
        type
      const analyticsData = isObject(analytics) ? omit('eventName', analytics) : {}

      if (isLoggedIn && me?.id) identifyAnalytics(me.id)

      mixpanel.track(trackingEventName, analyticsData)
    }

    return next(action)
  }
}
