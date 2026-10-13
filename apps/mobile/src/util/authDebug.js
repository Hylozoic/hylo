import Config from 'react-native-config'

// Auth diagnostics that survive STAGING/RELEASE builds. Two things normally hide
// logs exactly where we need them:
//   1. `__DEV__` is false, so `if (__DEV__)`-gated logs never run.
//   2. babel `transform-remove-console` strips literal `console.*` calls.
// We work around both: toggle via AUTH_DEBUG, and call the console through an
// indirect reference the transform can't statically match/remove. We also mirror
// into Sentry (breadcrumbs + one event) so you can diagnose without a cable.
//
// Enable by setting `AUTH_DEBUG=true` in apps/mobile/.env before building.
// Remove it (or set false) for production.
export const AUTH_DEBUG = Config.AUTH_DEBUG === 'true'

// Indirect console reference — `transform-remove-console` only removes calls
// whose callee is literally `console.<method>(...)`, so a bound alias survives.
const rawConsole = typeof global !== 'undefined' ? global.console : undefined
const rawLog = rawConsole && rawConsole.log ? rawConsole.log.bind(rawConsole) : () => {}

// Lazy Sentry access: keeps the native module out of the import graph for unit
// tests and only loads it when diagnostics are actually enabled.
function withSentry (fn) {
  try {
    fn(require('@sentry/react-native'))
  } catch (e) { /* Sentry unavailable (e.g. tests) — console output is enough */ }
}

// High-frequency diagnostic line: console (survives strip) + Sentry breadcrumb
// (attached to any captured event). Tagged "[auth]" for easy log filtering.
export function authLog (...args) {
  if (!AUTH_DEBUG) return
  rawLog('[auth]', ...args)
  withSentry(Sentry => Sentry.addBreadcrumb({
    category: 'auth',
    level: 'info',
    message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  }))
}

// Decisive, low-frequency moment worth surfacing in Sentry as its own event so
// it's visible without a device attached (e.g. the social-login token decision).
export function authEvent (message, data) {
  if (!AUTH_DEBUG) return
  rawLog('[auth][event]', message, data || '')
  withSentry(Sentry => Sentry.captureMessage(`[auth] ${message}`, { level: 'info', extra: data }))
}

// Masks a token for logging — never log full credentials. Shows a short prefix
// and the length so two tokens can be told apart without leaking them.
export function maskToken (token) {
  if (!token) return 'none'
  const str = String(token)
  return `${str.slice(0, 6)}…(len=${str.length})`
}
