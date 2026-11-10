import { get, isString, isObject, omit } from 'lodash/fp'
import mixpanel from 'mixpanel-browser'
import { getAuthenticated } from '../selectors/getSignupState'
import getMe from '../selectors/getMe'
import { getCookieConsent } from 'util/cookieConsent'
import { isSandboxMode } from 'sandbox/isSandbox'
import { queryHyloAPI } from 'util/graphql'
import { getAnonymousId } from 'util/anonymousId'

const RECORD_EVENTS = `mutation RecordEvents($anonymousId: String, $events: [ClientEventInput!]!) {
  recordEvents(anonymousId: $anonymousId, events: $events) { recorded }
}`

/** Sends the same event to first-party analytics. Failures are ignored. */
function recordFirstParty (name, properties) {
  const anonymousId = getAnonymousId()
  queryHyloAPI({
    query: RECORD_EVENTS,
    variables: {
      anonymousId,
      events: [{ name, occurredAt: new Date().toISOString(), properties: properties || {} }]
    }
  }).catch(() => {})
}

export default function mixpanelMiddleware (store) {
  return next => action => {
    const { error, type, meta } = action

    if (!error && !type.match(/_PENDING$/) && meta && meta.analytics) {
      // meta.analytics can be either simply true, a string (name of event) or a hash
      // with data that will be attached to the event sent to mixpanel (eventName being
      // a required key).
      const state = store.getState()

      if (isSandboxMode()) return next(action)

      // Cookie consent check
      const consent = getCookieConsent()
      if (consent && consent.analytics === false) return next(action)

      const isLoggedIn = getAuthenticated(state)
      const { analytics } = meta
      const trackingEventName = get('eventName', analytics) ||
        (isString(analytics) && analytics) ||
        type
      const analyticsData = isObject(analytics) ? omit('eventName', analytics) : {}

      recordFirstParty(trackingEventName, analyticsData)

      if (!import.meta.env.VITE_MIXPANEL_TOKEN || !mixpanel) return next(action)

      if (isLoggedIn) mixpanel.identify(getMe(state).id)

      mixpanel.track(trackingEventName, analyticsData)
    }

    return next(action)
  }
}
