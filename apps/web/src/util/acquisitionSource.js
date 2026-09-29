/**
 * First-touch acquisition source: where a visitor first came from, kept in
 * this browser (localStorage, whatever the cookie choice, as decided) and sent
 * with signup so the new account keeps it. It holds only:
 * - referrer: the host name of an external site that linked here
 * - utmSource, utmMedium, utmCampaign: the link's utm tags, each capped
 * - channel: 'invite' for a join or invitation link, or 'sandbox_demo' when
 *   signup starts from the demo banner
 *
 * The first touch wins. Referrer and utm tags are set together, by the first
 * visit that has any of them; channel is set once, by the first invite link
 * or demo signup. A visit with nothing to record doesn't use up either slot.
 */

export const ACQUISITION_SOURCE_KEY = 'hyloAcquisitionSource'
export const MAX_VALUE_LENGTH = 64
const MAX_HOST_LENGTH = 253

const UTM_PARAMS = [['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'], ['utm_campaign', 'utmCampaign']]
const ORIGIN_KEYS = ['referrer', 'utmSource', 'utmMedium', 'utmCampaign']
const INVITE_PATH = /^\/(groups\/[^/]+\/join\/[^/]+|h\/use-invitation|h\/invitation)\/?$/

export function readAcquisitionSource () {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ACQUISITION_SOURCE_KEY) || 'null')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : null
  } catch (e) {
    return null
  }
}

function writeAcquisitionSource (source) {
  try {
    window.localStorage.setItem(ACQUISITION_SOURCE_KEY, JSON.stringify(source))
  } catch (e) { /* storage unavailable: nothing is kept */ }
}

function cap (value, max = MAX_VALUE_LENGTH) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function externalHost (referrer, currentHost) {
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (!host || host === (currentHost || '').toLowerCase() || host.length > MAX_HOST_LENGTH) return null
    return host
  } catch (e) {
    return null
  }
}

/**
 * Reads this visit's source from the address and referrer, and stores what
 * fills an empty slot. Call it once per page load, before any redirect drops
 * the query string.
 */
export function captureAcquisitionSource ({ location = window.location, referrer = document.referrer } = {}) {
  const stored = readAcquisitionSource() || {}
  const next = { ...stored }

  if (!ORIGIN_KEYS.some(key => stored[key])) {
    const host = externalHost(referrer, location.hostname)
    if (host) next.referrer = host
    const params = new URLSearchParams(location.search || '')
    for (const [param, key] of UTM_PARAMS) {
      const value = cap(params.get(param))
      if (value) next[key] = value
    }
  }

  if (!stored.channel && INVITE_PATH.test(location.pathname || '')) next.channel = 'invite'

  if (Object.keys(next).length > Object.keys(stored).length) writeAcquisitionSource(next)
  return next
}

/** Marks that signup started from the sandbox demo's banner, unless a channel is already set. */
export function markSandboxSignup () {
  const stored = readAcquisitionSource() || {}
  if (stored.channel) return
  writeAcquisitionSource({ ...stored, channel: 'sandbox_demo' })
}

/** The stored source in the shape of the AcquisitionSourceInput GraphQL input, or undefined. */
export function acquisitionSourceInput () {
  const stored = readAcquisitionSource()
  if (!stored) return undefined
  const input = {}
  for (const key of [...ORIGIN_KEYS, 'channel']) {
    const value = cap(stored[key], key === 'referrer' ? MAX_HOST_LENGTH : MAX_VALUE_LENGTH)
    if (value) input[key] = value
  }
  return Object.keys(input).length ? input : undefined
}
