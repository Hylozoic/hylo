/**
 * Cleans a first-touch acquisition source sent at signup (see the web app's
 * util/acquisitionSource.js) into what users.acquisition_source keeps:
 * referrer (a host name only), utm_source, utm_medium, utm_campaign (each
 * capped) and channel ('invite' or 'sandbox_demo'). Anything else is dropped.
 *
 * Accepts the GraphQL input shape (utmSource), the stored shape (utm_source)
 * or a JSON string of either. Returns null when nothing usable is left.
 */

export const MAX_VALUE_LENGTH = 64
const MAX_HOST_LENGTH = 253
const CHANNELS = ['invite', 'sandbox_demo']
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/

const TEXT_FIELDS = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign']
]

function cleanText (value) {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_VALUE_LENGTH).trim()
  return cleaned || null
}

function cleanHost (value) {
  if (typeof value !== 'string') return null
  let host = value.trim().toLowerCase()
  if (/[/:?#@]/.test(host)) {
    try {
      host = new URL(host.includes('://') ? host : `https://${host}`).hostname
    } catch (err) {
      return null
    }
  }
  if (!host || host.length > MAX_HOST_LENGTH || !HOST_PATTERN.test(host)) return null
  return host
}

export function sanitizeAcquisitionSource (input) {
  let source = input
  if (typeof source === 'string') {
    if (source.length > 2000) return null
    try {
      source = JSON.parse(source)
    } catch (err) {
      return null
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null

  const result = {}
  const referrer = cleanHost(source.referrer)
  if (referrer) result.referrer = referrer
  for (const [inputKey, storedKey] of TEXT_FIELDS) {
    const value = cleanText(source[inputKey] ?? source[storedKey])
    if (value) result[storedKey] = value
  }
  if (CHANNELS.includes(source.channel)) result.channel = source.channel

  return Object.keys(result).length > 0 ? result : null
}
