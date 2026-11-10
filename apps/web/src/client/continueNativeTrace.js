import * as Sentry from '@sentry/react'

function metaContent (name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || undefined
}

/*
  Inside the mobile app, HyloWebView injects the native app's trace as `sentry-trace` /
  `baggage` meta tags (@sentry/react-native's sentryWebViewProps). Normally only
  browserTracingIntegration reads them, and it also creates pageload/navigation spans,
  which we avoid for quota. Instead this sets the same propagation context on the scope,
  so error events carry the native trace id while no spans or transactions are created.

  Returns true when a native trace was found and continued.
*/
export default function continueNativeTrace () {
  const sentryTrace = metaContent('sentry-trace')
  if (!sentryTrace) return false

  // continueTrace parses the headers (and honours strict org trace continuation) but only
  // applies them inside its callback, so copy the resulting context onto the current scope.
  const propagationContext = Sentry.continueTrace(
    { sentryTrace, baggage: metaContent('baggage') },
    () => Sentry.getCurrentScope().getPropagationContext()
  )
  Sentry.getCurrentScope().setPropagationContext(propagationContext)
  return true
}
