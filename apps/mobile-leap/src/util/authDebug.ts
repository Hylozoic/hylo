import { AUTH_DEBUG } from 'config'

const rawConsole = typeof global !== 'undefined' ? global.console : undefined
const rawLog = rawConsole?.log ? rawConsole.log.bind(rawConsole) : () => {}

// High-frequency diagnostic line when AUTH_DEBUG=true in app config extra.
export function authLog (...args: unknown[]) {
  if (!AUTH_DEBUG) return
  rawLog('[auth]', ...args)
}

export function authEvent (message: string, data?: unknown) {
  if (!AUTH_DEBUG) return
  rawLog('[auth][event]', message, data ?? '')
}

export function maskToken (token: string | null | undefined) {
  if (!token) return 'none'
  const str = String(token)
  return `${str.slice(0, 6)}…(len=${str.length})`
}
