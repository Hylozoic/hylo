import { WebViewMessageTypes } from '@hylo/shared'

export function sendMessageToWebView (type, data) {
  if (!type) {
    throw new Error('Must provide a message `type` when sending a message to the WebView')
  }

  isWebView() && window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }))
}

/** User-initiated logout from the v2 mobile shell — skip session recovery. */
export function beginMobileWebViewUserLogout () {
  if (typeof window !== 'undefined' && window.HyloMobileV2) {
    window.__hyloMobileUserLogout = true
  }
}

export function isMobileWebViewUserLogoutInProgress () {
  return typeof window !== 'undefined' &&
    window.HyloMobileV2 &&
    window.__hyloMobileUserLogout === true
}

export function clearMobileWebViewUserLogout () {
  if (typeof window !== 'undefined') {
    window.__hyloMobileUserLogout = false
  }
}

/**
 * Log out in browser or v2 mobile WebView. In mobile, notify native first and set a
 * guard so RootRouter shows a spinner instead of re-rendering auth routes with an
 * empty store (which crashes views like /my ContextMenuGrid).
 */
export async function logoutFromMobileWebView (dispatch, logoutAction, replaceLoginAction) {
  if (window.HyloMobileV2) {
    beginMobileWebViewUserLogout()
    sendMessageToWebView(WebViewMessageTypes.LOGOUT)
    return dispatch(logoutAction)
  }
  await dispatch(logoutAction)
  if (replaceLoginAction) dispatch(replaceLoginAction)
}

export default function isWebView () {
  return typeof window !== 'undefined' && window.ReactNativeWebView
}

/**
 * Returns true when running inside an OLD mobile app's WebView that hasn't
 * been updated to the v2 architecture. The new mobile app injects
 * `window.HyloMobileV2 = true` before content loads; old apps don't.
 * Use this to preserve backward-compatible behavior (e.g. hiding web nav,
 * sending native messages) until old app versions are sunset.
 */
export function isLegacyWebView () {
  return isWebView() && !window.HyloMobileV2
}

/**
 * Native app version string injected by Hylo mobile before the web app loads
 * (`window.HyloMobileAppVersion`). Empty string when not in the v2 WebView or
 * when the host did not pass a version.
 */
export function getMobileAppVersion () {
  if (typeof window === 'undefined') return ''
  const v = window.HyloMobileAppVersion
  if (v == null || v === '') return ''
  return String(v)
}
