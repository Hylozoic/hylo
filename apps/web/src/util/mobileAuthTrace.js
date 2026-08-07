import errorReporter, { addBreadcrumb, SENTRY_DEBUG } from 'client/errorReporter'

/*
  Breadcrumbs for the native WebView auth handshake (checkLogin ↔ VERIFY_AUTH).
  Only runs inside HyloMobileV2, or everywhere when VITE_SENTRY_DEBUG is on.

  Sentry only ships breadcrumbs with an event — use mobileAuthReport() on a timer
  while loading so stalled sessions still appear in the dashboard.
*/
export const MOBILE_AUTH_REPORT_FIRST_MS = 5000
export const MOBILE_AUTH_REPORT_INTERVAL_MS = 10000

function shouldTrace () {
  if (typeof window === 'undefined') return false
  if (SENTRY_DEBUG) return true
  return !!window.HyloMobileV2
}

/** Records a breadcrumb on the current Sentry error (WebView auth flow) */
export function mobileAuthBreadcrumb (message, data) {
  if (!shouldTrace()) return
  addBreadcrumb({
    category: 'mobile-auth',
    message,
    data: data || {},
    level: 'info'
  })
}

/** Warning-level Sentry event (includes buffered breadcrumbs) */
export function mobileAuthReport (message, extra) {
  if (!shouldTrace()) return
  mobileAuthBreadcrumb(message, extra)
  errorReporter.diagnostic(message, extra)
}

/** Error-level Sentry event for hard failures (max retries, bootstrap throw) */
export function mobileAuthStuck (message, extra) {
  if (!shouldTrace()) return
  mobileAuthBreadcrumb(message, extra)
  errorReporter.error(message, extra)
}

/**
 * While `isActive` returns true: one immediate report, then periodic reports for Sentry.
 */
export function scheduleMobileAuthStuckReports (isActive, report) {
  if (!shouldTrace() || !isActive()) return () => {}

  report()

  const initial = setTimeout(() => {
    if (isActive()) report()
  }, MOBILE_AUTH_REPORT_FIRST_MS)

  const interval = setInterval(() => {
    if (isActive()) report()
  }, MOBILE_AUTH_REPORT_INTERVAL_MS)

  return () => {
    clearTimeout(initial)
    clearInterval(interval)
  }
}
