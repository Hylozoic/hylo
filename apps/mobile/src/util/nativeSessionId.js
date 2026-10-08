import * as Sentry from '@sentry/react-native'

let nativeSessionId

/*
  Returns a stable, per-app-launch id used to correlate native Sentry events
  with web Sentry events raised inside the embedded WebView.

  On first use it tags the native Sentry scope with `nativeSessionId`;
  HyloWebView injects the same value into the page as
  `window.HyloNativeSessionId`, which the web error reporter picks up as a tag.
  Searching Sentry for one nativeSessionId then shows both sides of a session.
*/
export default function getNativeSessionId () {
  if (!nativeSessionId) {
    nativeSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    Sentry.setTag('nativeSessionId', nativeSessionId)
  }
  return nativeSessionId
}
