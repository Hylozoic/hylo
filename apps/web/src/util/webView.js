export function sendMessageToWebView (type, data) {
  if (!type) {
    throw new Error('Must provide a message `type` when sending a message to the WebView')
  }

  isWebView() && window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }))
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
