import type { Mixpanel } from 'mixpanel-react-native'

type CurrentUser = {
  cookieConsentPreferences?: { settings?: { analytics?: boolean } }
}

export function trackWithConsent (
  event: string,
  props?: Record<string, unknown>,
  currentUser?: CurrentUser | null
): void

declare const mixpanel: Mixpanel | null
export default mixpanel
