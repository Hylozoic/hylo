/**
 * Handle derivation and validation for Hylo-hosted AT Protocol identities.
 *
 * Handles are a single label under the configured handle domain, e.g. alice.hylo.com.
 * Since that domain also hosts Hylo's own services, infrastructure names are reserved.
 */
import { ensureValidHandle, isValidTld } from '@atproto/syntax'

const MAX_LABEL_LENGTH = 63

// Subdomains that are (or could plausibly become) Hylo infrastructure, plus names that
// would be confusing or abusable as a user handle. Check against real DNS before production.
export const RESERVED_NAMES = new Set([
  'abuse', 'admin', 'administrator', 'api', 'app', 'apps', 'assets', 'atproto', 'auth',
  'beta', 'blog', 'bsky', 'cdn', 'chat', 'dashboard', 'demo', 'dev', 'docs', 'email',
  'feed', 'feeds', 'files', 'ftp', 'help', 'hooks', 'hylo', 'id', 'imap', 'inbound',
  'inbound-staging', 'info', 'login', 'm', 'mail', 'media', 'mobile', 'no-reply', 'noreply',
  'oauth', 'pds', 'plc', 'pop', 'postmaster', 'relay', 'root', 'security', 'smtp', 'socket',
  'sso', 'staging', 'static', 'status', 'support', 'system', 'terran', 'test', 'uploads',
  'webhooks', 'webmaster', 'ws', 'www'
])

const trimHyphens = s => s.replace(/^-+|-+$/g, '')

/**
 * Turns an email's local part into a handle label: lowercased, "+tags" dropped, dots and
 * underscores turned into hyphens, everything else outside [a-z0-9-] removed.
 * Returns null if nothing usable is left.
 */
export function handleNameFromEmail (email) {
  const local = (email || '').split('@')[0].split('+')[0].toLowerCase()
  const name = trimHyphens(
    local
      .replace(/[._]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
  )
  return name ? trimHyphens(name.slice(0, MAX_LABEL_LENGTH)) : null
}

/**
 * The nth candidate for a name, used to resolve collisions: alice, alice-2, alice-3...
 */
export function handleNameCandidate (name, n = 1) {
  if (n <= 1) return name
  const suffix = `-${n}`
  return trimHyphens(name.slice(0, MAX_LABEL_LENGTH - suffix.length)) + suffix
}

export const buildHandle = (name, handleDomain) => `${name}.${handleDomain}`.toLowerCase()

/**
 * Returns null if `name` can be used under `handleDomain`, otherwise the reason it can't.
 */
export function handleNameProblem (name, handleDomain) {
  if (!name) return 'empty'
  if (name.includes('.')) return 'must be a single label'
  if (RESERVED_NAMES.has(name)) return 'reserved'
  const handle = buildHandle(name, handleDomain)
  try {
    ensureValidHandle(handle)
  } catch (e) {
    return e.message
  }
  if (!isValidTld(handle)) return 'disallowed top-level domain'
  return null
}

/**
 * The handle label for `handle` if it is directly under `handleDomain`, else null.
 * Used to map an incoming Host header (alice.hylo.com) back to a handle we may own.
 */
export function handleNameFromHost (host, handleDomain) {
  const hostname = (host || '').split(':')[0].toLowerCase().replace(/\.$/, '')
  const suffix = `.${handleDomain}`
  if (!hostname.endsWith(suffix)) return null
  const name = hostname.slice(0, -suffix.length)
  return name && !name.includes('.') ? name : null
}
