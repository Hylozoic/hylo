/*
  fetch() transport failures. The browser rejected the request before any HTTP
  status arrived (offline, aborted, blocked). These are not application errors.
*/

export const BROWSER_NETWORK_ERROR_MESSAGES = [
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
  'Network request failed',
  'The Internet connection appears to be offline.',
  'The user aborted a request.',
  'The operation was aborted.'
]

const NETWORK_ERROR_NAMES = new Set(['TypeError', 'AbortError', 'NetworkError'])

/**
 * True when a fetch failed in the browser and the server never answered.
 * An attached `response` means we got HTTP back, so that error stays reportable.
 */
export default function isBrowserNetworkError (error) {
  if (!error || typeof error !== 'object') return false
  if (error.response) return false
  if (!NETWORK_ERROR_NAMES.has(error.name)) return false
  return isBrowserNetworkErrorMessage(error.message)
}

/** True when `message` is a known fetch transport failure, with an optional " (host)" suffix. */
export function isBrowserNetworkErrorMessage (message) {
  if (typeof message !== 'string') return false
  return BROWSER_NETWORK_ERROR_MESSAGES.some(known =>
    message === known || message.startsWith(`${known} (`)
  )
}

/**
 * Sentry ignoreErrors patterns for the same failures, including the
 * "action error for TYPE: …" string the redux reporter used to send.
 */
export function browserNetworkErrorIgnorePatterns () {
  return BROWSER_NETWORK_ERROR_MESSAGES.flatMap(message => {
    const escaped = message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const withOptionalHost = `${escaped}(?: \\([^)]+\\))?`
    return [
      new RegExp(`^(?:[A-Za-z]*Error: )?${withOptionalHost}$`),
      new RegExp(`^action error for [A-Z0-9_]+: ${withOptionalHost}$`)
    ]
  })
}
