import { Mixpanel } from 'mixpanel-react-native'
import { API_HOST, MIXPANEL_TOKEN } from 'config'
import { getTokens } from 'util/tokenStore'

const trackAutomaticEvents = false
const useNative = false

const mixpanel = MIXPANEL_TOKEN
  ? new Mixpanel(MIXPANEL_TOKEN, trackAutomaticEvents, useNative)
  : null

if (mixpanel) {
  mixpanel.init()
}

/** Sends the event to first-party analytics as well as Mixpanel. */
async function recordFirstParty (event, props) {
  try {
    const tokens = await getTokens()
    await fetch(`${API_HOST}/noo/graphql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : {})
      },
      body: JSON.stringify({
        query: 'mutation RecordEvents($events: [ClientEventInput!]!) { recordEvents(events: $events) { recorded } }',
        variables: { events: [{ name: event, occurredAt: new Date().toISOString(), properties: props || {} }] }
      })
    })
  } catch {
    // Analytics must never break the screen that triggered it.
  }
}

/** Tracks an event unless the user has opted out of analytics. */
export function trackWithConsent (event, props, currentUser) {
  const consent = currentUser?.cookieConsentPreferences?.settings
  if (consent && consent.analytics === false) return
  recordFirstParty(event, props)
  if (!mixpanel) return
  mixpanel.track(event, props)
}

export default mixpanel
