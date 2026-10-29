import { sentryWebViewProps } from '@sentry/react-native'
import { URL } from 'react-native-url-polyfill'

// Sentry matches subdomains too, so 'hylo.com' covers www.hylo.com and staging.hylo.com
const hyloHosts = ['hylo.com']

/** Hosts that may receive the native Sentry trace: Hylo's own, plus the configured web host (e.g. localhost in dev) */
export function sentryAllowedHosts (webBaseUrl: string): string[] {
  try {
    const configuredHost = new URL(webBaseUrl).hostname.toLowerCase()
    const coveredByHyloHosts = hyloHosts.some(host => configuredHost === host || configuredHost.endsWith(`.${host}`))
    return configuredHost && !coveredByHyloHosts
      ? [...hyloHosts, configuredHost]
      : hyloHosts
  } catch {
    return hyloHosts
  }
}

/** Our window.Hylo* setup, which web reads at startup */
export function hyloSetupScript (mobileAppVersion: string | undefined, nativeSessionId: string): string {
  const trimmed = mobileAppVersion != null ? String(mobileAppVersion).trim() : ''
  const versionLine = trimmed !== ''
    ? `window.HyloMobileAppVersion=${JSON.stringify(trimmed)};`
    : ''
  const sessionIdLine = `window.HyloNativeSessionId=${JSON.stringify(nativeSessionId)};`
  return `${versionLine}${sessionIdLine}window.HyloWebView=true;window.HyloMobileV2=true;true;`
}

/*
  react-native-webview takes a single before-content script, so ours and Sentry's are
  concatenated rather than spread over each other. Sentry's writes the current native trace
  as `sentry-trace`/`baggage` meta tags (only on allowed hosts), which web's errorReporter
  reads so web errors share the native trace. It is '' when native Sentry is disabled.
*/
export function buildInjectedJavaScriptBeforeContentLoaded ({
  mobileAppVersion,
  nativeSessionId,
  webBaseUrl
}: {
  mobileAppVersion?: string
  nativeSessionId: string
  webBaseUrl: string
}): string {
  const hyloScript = hyloSetupScript(mobileAppVersion, nativeSessionId)
  const { injectedJavaScriptBeforeContentLoaded: sentryScript } =
    sentryWebViewProps({ allowedHosts: sentryAllowedHosts(webBaseUrl) })
  return sentryScript ? `${hyloScript}\n${sentryScript}` : hyloScript
}
