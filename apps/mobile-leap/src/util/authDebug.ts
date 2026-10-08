import * as Sentry from '@sentry/react-native'
import { AUTH_DEBUG, API_HOST } from 'config'

const rawConsole = typeof global !== 'undefined' ? global.console : undefined
const rawLog = rawConsole?.log ? rawConsole.log.bind(rawConsole) : () => {}

// Low-volume Sentry handshake events on staging/review API builds (and when AUTH_DEBUG).
// Production App Store + prod API stays quiet unless AUTH_DEBUG is explicitly set.
export const AUTH_HANDSHAKE_TELEMETRY =
  AUTH_DEBUG || String(API_HOST || '').includes('staging')

export { AUTH_DEBUG }

// High-frequency diagnostic line when AUTH_DEBUG=true in app config extra.
export function authLog (...args: unknown[]) {
  if (!AUTH_DEBUG) return
  rawLog('[auth]', ...args)
}

export function authEvent (message: string, data?: unknown) {
  if (!AUTH_DEBUG) return
  rawLog('[auth][event]', message, data ?? '')
}

/**
 * WebView auth handshake milestones for Sentry (staging/review builds).
 * Separate from AUTH_DEBUG so Bitrise review builds get events without verbose jar logs.
 */
export function authHandshakeEvent (
  message: string,
  data?: unknown,
  level: 'info' | 'warning' | 'error' = 'info'
) {
  if (!AUTH_HANDSHAKE_TELEMETRY) return
  rawLog('[auth][handshake]', message, data ?? '')
  try {
    const extra = (data && typeof data === 'object') ? data as Record<string, unknown> : { value: data }
    Sentry.addBreadcrumb({
      category: 'auth-handshake',
      level: 'info',
      message,
      data: extra
    })
    Sentry.captureMessage(`[auth-handshake] ${message}`, { level, extra })
  } catch (e) { /* Sentry unavailable — console output is enough */ }
}

export function maskToken (token: string | null | undefined) {
  if (!token) return 'none'
  const str = String(token)
  return `${str.slice(0, 6)}…(len=${str.length})`
}
