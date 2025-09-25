import Config from 'react-native-config'
import { Mixpanel } from 'mixpanel-react-native'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

// disable legacy mobile autotrack
const trackAutomaticEvents = false
// disable Native Mode, use Javascript Mode
const useNative = false

const mixpanel = new Mixpanel(Config.MIXPANEL_TOKEN, trackAutomaticEvents, useNative)
mixpanel && mixpanel.init()

export function trackWithConsent(event, props, currentUser) {
  const consent = currentUser?.cookieConsentPreferences?.settings
  if (consent && consent.analytics === false) return
  mixpanel.track(event, props)
}

export default mixpanel
