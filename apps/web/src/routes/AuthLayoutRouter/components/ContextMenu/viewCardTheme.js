import { POST_TYPES } from '@hylo/presenters/PostPresenter'
import { slateGrey } from '@hylo/presenters/colors'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

/**
 * Brand colors for post-type stream views only.
 * Custom, map, members, chat, all, welcome, etc. use slate grey —
 * still with the icon-field background, just neutrally tinted.
 */
const POST_TYPE_VIEW_COLOR = {
  discussions: POST_TYPES.discussion.primaryColor,
  events: POST_TYPES.event.primaryColor,
  'requests-and-offers': POST_TYPES.request.primaryColor,
  resources: POST_TYPES.resource.primaryColor,
  projects: POST_TYPES.project.primaryColor,
  proposals: POST_TYPES.proposal.primaryColor,
  decisions: POST_TYPES.proposal.primaryColor
}

/** Brand color for a view card — post-type colors, or slate grey for everything else.
 *  Post views take the shared post's own type color. */
export function viewCardColor (view) {
  if (view?.type === 'post') {
    const postTypeColor = POST_TYPES[view.viewPost?.type]?.primaryColor
    if (postTypeColor) return postTypeColor
  }
  return POST_TYPE_VIEW_COLOR[view?.type] || slateGrey
}

/** Start DateTime for an event shared as a post view, or null. */
export function eventStartForView (view) {
  if (view?.type !== 'post' || view.viewPost?.type !== 'event' || !view.viewPost.startTime) return null
  return DateTimeHelpers.toDateTime(view.viewPost.startTime, {
    timezone: view.viewPost.timezone || DateTimeHelpers.getCurrentTimezone(),
    locale: getLocaleFromLocalStorage()
  })
}

/**
 * Card footprint on sm and up. CardIconField uses these to work out how many
 * glyphs the wallpaper needs, so it has to match CARD_CLASS.
 */
export const CARD_W = 168
export const CARD_H = 156

/** Card title. Tight leading so a wrapped two-line title reads as one block. */
export const CARD_TITLE_CLASS = 'text-sm font-bold line-clamp-2 m-0 leading-[1.1]'

/**
 * Shared card footprint and interaction. Cards are deliberately dark in both
 * themes — each is a mini canvas tinted by its view's brand color, per the
 * one-column dashboard design. Below sm the width is fluid, so the aspect ratio
 * (14/13 — the same proportion as CARD_W/CARD_H) stands in for the fixed size.
 *
 * The sub-sm width subtracts half of the grid's gap-3 so two cards fit a row
 * exactly. It has to be expressed in rem, not px: gap-3 is 0.75rem, so on a
 * phone (where the root font size is larger) a hardcoded 6px left the pair
 * fractionally over 100% and wrapped them one per row.
 */
export const CARD_SIZE_CLASS = 'w-[calc(50%-0.375rem)] aspect-[14/13] sm:w-[168px] sm:h-[156px] sm:aspect-auto'

export const CARD_CLASS = `group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${CARD_SIZE_CLASS} cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] active:duration-[50ms]`

/**
 * For a card rendered inside a wrapper that carries CARD_SIZE_CLASS itself (the
 * sortable grid). The sub-sm width is a percentage of the parent, so a card left
 * to size itself inside an auto-width wrapper collapses to nothing — the wrapper
 * takes the size and the card fills it.
 */
export const CARD_FILL_CLASS = 'w-full h-full aspect-auto'

/** Scheme-dependent card border + resting shadow. */
export function cardChrome (isDark) {
  return isDark
    ? 'border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
    : 'border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
}

export const cardHoverShadow = (isDark) => isDark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 12px 30px rgba(0,0,0,0.18)'
/** Rest shadow mirrors cardChrome's class values so inline hover shadows transition smoothly. */
export const cardRestShadow = (isDark) => isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.12)'

/**
 * Readable icon ink for a solid color tile. Light brand colors (gold, for
 * Resources) need dark ink, but a deep mix of the tile color itself reads as
 * on-theme where flat black looked like a rendering bug.
 */
export function inkOn (hex) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? `color-mix(in srgb, ${hex} 32%, #17181a)` : '#ffffff'
}

/** Card surface gradient tinted by the view color, per color scheme. */
export function cardGradient (col, scheme = 'dark') {
  return scheme === 'dark'
    ? `linear-gradient(150deg, color-mix(in srgb, ${col} 30%, #16171a), color-mix(in srgb, ${col} 17%, #0d0e10))`
    : `linear-gradient(150deg, color-mix(in srgb, ${col} 24%, #ffffff), color-mix(in srgb, ${col} 11%, #f3f1ea))`
}

/**
 * The card surface's base color — the far end of cardGradient — at a given alpha.
 * Used to fade the icon pattern back into the card toward the bottom.
 */
export function cardBaseColor (scheme = 'dark', alpha = 1) {
  return scheme === 'dark' ? `rgb(13 14 16 / ${alpha})` : `rgb(243 241 234 / ${alpha})`
}

/** Settles the icon pattern toward the card's base color at the bottom, so the label reads clearly. */
export function cardFadeGradient (scheme = 'dark') {
  return `linear-gradient(180deg, transparent 0%, ${cardBaseColor(scheme, 0.5)} 100%)`
}

/**
 * The fade overlay itself. Hovering halves it, letting more of the icon
 * wallpaper through — CARD_CLASS carries `group`, so this needs no JS.
 */
export const CARD_FADE_CLASS = 'absolute inset-0 pointer-events-none transition-opacity duration-200 opacity-100 group-hover:opacity-50'

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
