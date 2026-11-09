import { Mixpanel } from 'mixpanel-react-native'
import { MIXPANEL_TOKEN } from 'config'

const trackAutomaticEvents = false
const useNative = false

const mixpanel = MIXPANEL_TOKEN
  ? new Mixpanel(MIXPANEL_TOKEN, trackAutomaticEvents, useNative)
  : null

if (mixpanel) {
  mixpanel.init()
}

type CurrentUser = {
  cookieConsentPreferences?: { settings?: { analytics?: boolean } }
}

export function trackWithConsent (
  event: string,
  props?: Record<string, unknown>,
  currentUser?: CurrentUser | null
) {
  if (!mixpanel) return
  const consent = currentUser?.cookieConsentPreferences?.settings
  if (consent && consent.analytics === false) return
  mixpanel.track(event, props)
}

export default mixpanel
