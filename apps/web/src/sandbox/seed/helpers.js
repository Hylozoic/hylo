import { PLACEHOLDER_COPY, PLACEHOLDER_NAME, SANDBOX_ID_PREFIX } from './constants'

/**
 * Wrap plain placeholder copy as HTML for rich-text post/comment bodies.
 */
export function htmlCopy (text = PLACEHOLDER_COPY) {
  return `<p>${text}</p>`
}

/**
 * Build a sandbox-scoped string id.
 */
export function sid (...parts) {
  return [SANDBOX_ID_PREFIX, ...parts].join('-')
}

/**
 * Minimal person stub for lists, reactions, and memberships.
 */
export function personStub (id, overrides = {}) {
  return {
    id,
    name: PLACEHOLDER_NAME,
    avatarUrl: null,
    ...overrides
  }
}

/**
 * Convert relative offset (seconds before now) to ISO timestamp at load time.
 */
export function materializeOffset (offsetSeconds, now = Date.now()) {
  return new Date(now + offsetSeconds * 1000).toISOString()
}

/**
 * Walk seed objects and replace *_offset fields with absolute ISO dates.
 */
export function materializeTimestamps (value, now = Date.now()) {
  if (Array.isArray(value)) {
    return value.map(item => materializeTimestamps(item, now))
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (key.endsWith('_offset') && typeof val === 'number') {
        const targetKey = key.replace(/_offset$/, '')
        out[targetKey] = materializeOffset(val, now)
        continue
      }
      out[key] = materializeTimestamps(val, now)
    }
    return out
  }
  return value
}

/**
 * Default Mapbox-friendly location for demo groups (Portland-ish).
 */
export function defaultLocationObject (id) {
  return {
    id,
    fullText: PLACEHOLDER_COPY.slice(0, 80),
    city: PLACEHOLDER_NAME,
    region: PLACEHOLDER_NAME,
    country: PLACEHOLDER_NAME,
    center: { lat: 45.5231, lng: -122.6765 },
    bbox: { lat: 45.5231, lng: -122.6765 }
  }
}
