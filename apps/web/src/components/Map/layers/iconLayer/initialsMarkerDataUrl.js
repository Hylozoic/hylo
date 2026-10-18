import { groupInitials } from 'util/groupInitials'

const CACHE = new Map()
const SIZE = 42

/**
 * Circular map marker for a group with no avatar, labeled with its initials.
 * Same 42px circle and hairline stroke as uploaded group map avatars.
 * @param {string} name
 * @returns {string}
 */
export function initialsMarkerDataUrl (name) {
  const initials = groupInitials(name) || '?'
  const [from, to] = themeStops()
  const key = `${initials}|${from}|${to}`
  if (CACHE.has(key)) return CACHE.get(key)

  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markerSvg(initials, from, to))
  CACHE.set(key, url)
  return url
}

/** Theme colors for the initials fill, with the stock teal-to-blue pair as a fallback. */
function themeStops () {
  const read = (variable, fallback) => {
    if (typeof document === 'undefined') return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
    return value ? `hsl(${value})` : fallback
  }
  return [read('--focus', '#0DC39F'), read('--selected', '#40A0DD')]
}

/** SVG for one initials circle. */
function markerSvg (initials, from, to) {
  const label = initials.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[char]))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    '<defs><linearGradient id="initials" x1="0" y1="0" x2="1" y2="1">' +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    '</linearGradient></defs>' +
    '<circle cx="21" cy="21" r="20.5" fill="url(#initials)" stroke="#000" stroke-width="1"/>' +
    `<text x="21" y="22" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="system-ui, sans-serif" font-size="15" font-weight="700">${label}</text>` +
    '</svg>'
}
