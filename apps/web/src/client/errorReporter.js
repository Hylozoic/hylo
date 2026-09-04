import * as Sentry from '@sentry/react'
import { isSandboxMode } from 'sandbox/isSandbox'

/*
  Sentry-backed error reporter (replaces the old Rollbar integration).

  Configured entirely through Vite build-time env vars:
    VITE_SENTRY_DSN    - enables reporting when set (use the same DSN as the mobile app to share one Sentry project)
    VITE_SENTRY_ENV    - Sentry environment tag (e.g. 'production', 'staging', 'reviewApp'); falls back to the Vite mode
    VITE_SENTRY_DEBUG  - 'true' turns on verbose breadcrumbs (redux actions, larger breadcrumb buffer) for staging diagnostics
*/

const dsn = import.meta.env.VITE_SENTRY_DSN
const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE

export const SENTRY_DEBUG =
  import.meta.env.VITE_SENTRY_DEBUG === 'true' ||
  import.meta.env.VITE_SENTRY_DEBUG === '1'

const enabled = typeof window !== 'undefined' && !!dsn

if (typeof window !== 'undefined') {
  window.__hyloSentryStatus = {
    enabled,
    debug: SENTRY_DEBUG,
    environment: enabled ? environment : null
  }
}

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    debug: SENTRY_DEBUG,
    // Error reporting only -- no performance tracing (keeps quota and bundle impact low)
    tracesSampleRate: 0,
    maxBreadcrumbs: SENTRY_DEBUG ? 200 : 50
  })

  window.__hyloSentryTest = () => {
    Sentry.captureException(new Error('Hylo web Sentry test'))
  }

  // Tags set by the mobile app via injectedJavaScriptBeforeContentLoaded in
  // HyloWebView, so they are guaranteed to exist before this module runs.
  // These let us filter web errors by "inside the mobile WebView" and correlate
  // them with the native Sentry session that embedded the page.
  Sentry.setTag('mobileWebView', window.HyloMobileV2 ? 'true' : 'false')
  if (window.HyloMobileAppVersion) Sentry.setTag('mobileAppVersion', window.HyloMobileAppVersion)
  if (window.HyloNativeSessionId) Sentry.setTag('nativeSessionId', window.HyloNativeSessionId)
  if (isSandboxMode()) Sentry.setTag('sandbox', 'true')
}

/** Records a Sentry breadcrumb (no-op when reporting is disabled) */
export function addBreadcrumb (breadcrumb) {
  if (!enabled) return
  Sentry.addBreadcrumb(breadcrumb)
}

/*
  Drop-in replacement for the old rollbar facade, so existing call sites keep
  their `errorReporter.error(...)` / `errorReporter.configure(...)` shape.
*/
const errorReporter = {
  disabled: !enabled,

  /** Reports an error or message string to Sentry, with optional extra context */
  error (errorOrMessage, context) {
    if (!enabled) {
      console.error(errorOrMessage, context)
      return
    }
    if (errorOrMessage instanceof Error) {
      Sentry.captureException(errorOrMessage, { extra: context })
    } else {
      Sentry.captureMessage(String(errorOrMessage), { level: 'error', extra: context })
    }
  },

  /** Rollbar-compatible configure: links the current user ({ payload: { person } }) to Sentry events */
  configure ({ payload } = {}) {
    if (!enabled) return
    const person = payload?.person
    if (person) {
      Sentry.setUser({ id: person.id, username: person.username, email: person.email })
    }
  }
}

export default errorReporter
