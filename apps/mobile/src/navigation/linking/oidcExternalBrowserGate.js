import { URL } from 'react-native-url-polyfill'

const HYLO_WEB_ORIGINS = new Set([
  'https://www.hylo.com',
  'https://staging.hylo.com'
])

const DEFAULT_APP_HOST = 'https://www.hylo.com'

/**
 * Hylo-as-OIDC-provider and third-party OIDC flows must stay in the system browser.
 * Used when App Links still deliver these URLs to the native app (merged manifest, etc.).
 */
export function shouldOpenHyloOidcInExternalBrowser (providedPathOrURL) {
  try {
    const u = new URL(providedPathOrURL, DEFAULT_APP_HOST)
    if (!HYLO_WEB_ORIGINS.has(u.origin)) return false
    const p = u.pathname
    if (p === '/oauth' || p.startsWith('/oauth/')) return true
    if (p.startsWith('/noo/oauth')) return true
    if (p.startsWith('/noo/oidc')) return true
    return false
  } catch {
    return false
  }
}

/** Full https URL to hand to Linking.openURL (preserves staging vs www). */
export function hyloUrlForExternalBrowser (providedPathOrURL) {
  return new URL(providedPathOrURL, DEFAULT_APP_HOST).toString()
}
