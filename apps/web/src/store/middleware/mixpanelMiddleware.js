import { get, isString, isObject, omit } from 'lodash/fp'
import { getAuthenticated } from '../selectors/getAuthState'
import getMe from '../selectors/getMe'
import { getCookieConsent } from 'util/cookieConsent'

// Lazy load mixpanel to avoid blocking initial bundle
let mixpanel = null
let mixpanelPromise = null

function getMixpanel () {
  if (mixpanel) return Promise.resolve(mixpanel)
  if (!mixpanelPromise) {
    mixpanelPromise = import('mixpanel-browser').then(module => {
      mixpanel = module.default
      return mixpanel
    })
  }
  return mixpanelPromise
}

export default function mixpanelMiddleware (store) {
  return next => action => {
    const { type, meta } = action

    if (!type.match(/_PENDING$/) && meta && meta.analytics) {
      // meta.analytics can be either simply true, a string (name of event) or a hash
      // with data that will be attached to the event sent to mixpanel (eventName being
      // a required key).
      const state = store.getState()

      if (!import.meta.env.VITE_MIXPANEL_TOKEN) return next(action)

      // Asynchronously get mixpanel and track event (non-blocking)
      getMixpanel().then(mp => {
        if (!mp) return

        // Cookie consent check
        const consent = getCookieConsent()
        if (consent && consent.analytics === false) return

        const isLoggedIn = getAuthenticated(state)
        const { analytics } = meta
        const trackingEventName = get('eventName', analytics) ||
          (isString(analytics) && analytics) ||
          type
        const analyticsData = isObject(analytics) ? omit('eventName', analytics) : {}

        if (isLoggedIn) mp.identify(getMe(state).id)

        mp.track(trackingEventName, analyticsData)
      }).catch(() => {
        // Silently fail if mixpanel fails to load
      })
    }

    return next(action)
  }
}
