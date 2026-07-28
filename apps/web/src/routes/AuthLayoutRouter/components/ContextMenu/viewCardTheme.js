import { POST_TYPES } from '@hylo/presenters/PostPresenter'
import { butterflyBush, mediumPurple, pictonBlue, slateGrey } from '@hylo/presenters/colors'

/**
 * Brand color for a dashboard view card, keyed by view type.
 * Post-type views use the canonical POST_TYPES primaryColor tokens; the rest
 * follow the prototype's palette mapped onto existing named colors.
 */
const VIEW_TYPE_COLOR = {
  chat: POST_TYPES.discussion.primaryColor,
  discussions: POST_TYPES.discussion.primaryColor,
  stream: POST_TYPES.discussion.primaryColor,
  'all-activity': POST_TYPES.discussion.primaryColor,
  posts: POST_TYPES.discussion.primaryColor,
  events: POST_TYPES.event.primaryColor,
  'requests-and-offers': POST_TYPES.request.primaryColor,
  resources: POST_TYPES.resource.primaryColor,
  projects: POST_TYPES.project.primaryColor,
  proposals: POST_TYPES.proposal.primaryColor,
  decisions: POST_TYPES.proposal.primaryColor,
  map: butterflyBush,
  members: butterflyBush,
  groups: butterflyBush,
  about: slateGrey,
  welcome: slateGrey,
  link: slateGrey,
  moderation: slateGrey,
  'track-actions': mediumPurple,
  tracks: mediumPurple,
  space: butterflyBush,
  group: butterflyBush,
  'funding-round-submissions': POST_TYPES.resource.primaryColor,
  'manage-round': POST_TYPES.resource.primaryColor,
  'funding-rounds': POST_TYPES.resource.primaryColor
}

export function viewCardColor (view) {
  return VIEW_TYPE_COLOR[view?.type] || pictonBlue
}

/** Readable icon ink for a solid color tile (dark ink on light brand colors like gold). */
export function inkOn (hex) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#141414' : '#ffffff'
}

/** Stable per-view seed so each card's icon field gets a distinct pattern. */
export function fieldSeed (id) {
  return String(id || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)
}

/** Card surface gradient tinted by the view color, per color scheme. */
export function cardGradient (col, scheme = 'dark') {
  return scheme === 'dark'
    ? `linear-gradient(150deg, color-mix(in srgb, ${col} 30%, #16171a), color-mix(in srgb, ${col} 17%, #0d0e10))`
    : `linear-gradient(150deg, color-mix(in srgb, ${col} 24%, #ffffff), color-mix(in srgb, ${col} 11%, #f3f1ea))`
}

/** Colored inset ring shown on card hover (hex-alpha so it interpolates in transitions). */
export function cardHoverRing (col) {
  return `inset 0 0 0 1px ${col}8C`
}

/** Zero-alpha version of the hover ring, so box-shadow transitions have a matching start value. */
export function cardRestRing (col) {
  return `inset 0 0 0 1px ${col}00`
}

/** Tint for the repeated icon-field glyphs, per scheme. */
export function cardFieldTint (col, scheme = 'dark') {
  return scheme === 'dark'
    ? `color-mix(in srgb, ${col} 60%, white)`
    : `color-mix(in srgb, ${col} 70%, #222222)`
}

/** Neutral card surface behind image-backed cards, per scheme. */
export function cardNeutralBg (scheme = 'dark') {
  return scheme === 'dark' ? 'hsl(0 0% 14%)' : 'hsl(0 0% 92%)'
}

/** Hue (0-360) of a hex color, for hsl()-based tints derived from brand tokens. */
export function hueOf (hex) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return 200
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let hue
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4
  return Math.round((hue * 60 + 360) % 360)
}
