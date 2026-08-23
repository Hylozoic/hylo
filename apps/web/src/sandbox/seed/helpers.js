import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from './constants'

/**
 * Wrap plain placeholder copy as HTML for rich-text post/comment bodies.
 */
export function htmlCopy (text = PLACEHOLDER_COPY) {
  return `<p>${text}</p>`
}

/**
 * Kind prefixes so generated ids stay unique and purely numeric (Hylo URLs
 * and helpers like removePostFromUrl only match /\\d+/).
 */
const KIND = {
  me: 1,
  person: 10,
  role: 11,
  location: 12,
  track: 13,
  'track-action': 14,
  'funding-round': 15,
  'proposal-option': 16,
  vote: 17,
  notification: 18,
  activity: 19,
  group: 20,
  space: 21,
  post: 30,
  comment: 40,
  reaction: 50,
  thread: 60,
  msg: 70,
  membership: 80,
  view: 90,
  mut: 99
}

const TOKEN = {
  main: 1,
  simple: 2,
  chat: 3,
  track: 4,
  funding: 5,
  coordinator: 1,
  member: 2,
  onboarding: 1,
  spring: 1,
  group: 1,
  starter: 90,
  staff: 12,
  dm: 2,
  dm2: 2,
  dm3: 3,
  g: 1,
  stream: 1,
  map: 2,
  events: 3,
  members: 4,
  'chat-space': 5,
  'track-space': 6,
  'funding-space': 7,
  'chat-main': 8,
  'track-actions': 9,
  'track-chat': 14,
  'track-members': 15,
  'fr-submissions': 10,
  'simple-chat': 11,
  'staff-chat': 13,
  post: 30,
  fr: 6,
  c: 7,
  r: 8,
  v: 9
}

function tokenToInt (token) {
  const value = String(token)
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  if (TOKEN[value] != null) return TOKEN[value]
  let h = 0
  for (let i = 0; i < value.length; i++) h = ((h << 5) - h) + value.charCodeAt(i)
  return Math.abs(h) % 1000
}

/**
 * Flatten hyphenated segments so sid('post', 'chat-001') !== sid('post', '001').
 */
function flattenParts (parts) {
  return parts.flatMap(part => String(part).split('-').filter(Boolean))
}

/**
 * Build a stable numeric sandbox id. Always digits so routing and close-url
 * helpers treat demo entities like production ids.
 */
export function sid (kind, ...rest) {
  if (rest.length === 1 && /^\d{10,}$/.test(String(rest[0]))) {
    return String(rest[0])
  }
  const kindN = KIND[kind] ?? 98
  let suffix = 0
  for (const part of flattenParts(rest)) {
    suffix = suffix * 1000 + (tokenToInt(part) % 1000)
  }
  return String(kindN * 1000000 + suffix)
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
 * Mapbox-friendly location for demo groups and posts in the East Bay.
 */
export function bayLocation (id, { fullText, city, lat, lng }) {
  return {
    id,
    fullText,
    city,
    region: 'California',
    country: 'United States',
    center: { lat, lng },
    bbox: { lat, lng }
  }
}

/**
 * Default Mapbox-friendly location for demo posts (downtown Oakland).
 */
export function defaultLocationObject (id) {
  return bayLocation(id, {
    fullText: 'Oakland, California, United States',
    city: 'Oakland',
    lat: 37.8044,
    lng: -122.2712
  })
}
