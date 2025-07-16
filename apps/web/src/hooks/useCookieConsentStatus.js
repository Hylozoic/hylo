import { useCookieConsent } from 'contexts/CookieConsentContext'

/**
 * Hook to check cookie consent status
 * Returns boolean values indicating consent for different cookie types
 */
export const useCookieConsentStatus = () => {
  const { hasAnalyticsConsent, hasSupportConsent, hasAnyConsent, isInitialized } = useCookieConsent()

  return {
    hasAnalyticsConsent: hasAnalyticsConsent(),
    hasSupportConsent: hasSupportConsent(),
    hasAnyConsent: hasAnyConsent(),
    isInitialized
  }
}
