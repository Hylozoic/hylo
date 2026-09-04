import * as Sentry from '@sentry/react-native'

let nativeSessionId: string | undefined

/** Stable per-app-launch id — tags native Sentry and is injected as window.HyloNativeSessionId for web. */
export default function getNativeSessionId (): string {
  if (!nativeSessionId) {
    nativeSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    Sentry.setTag('nativeSessionId', nativeSessionId)
  }
  return nativeSessionId
}
