/**
 * Group theme validation, shared by the web app (sanitize on read) and the
 * backend (validate on write) so both apply the same rules.
 *
 * A group stores its theme at `group.settings.theme`:
 *
 *   {
 *     light: { background: '120 15% 92%', 'card-foreground': '160 28% 11%', ... },
 *     dark:  { background: '120 20% 14%', ... },
 *     radius: 'lg',
 *     borderWidth: 'regular'
 *   }
 *
 * Only design tokens are stored, never CSS. Values are plain HSL triples.
 */

export const GROUP_THEME_COLOR_SCHEMES = ['light', 'dark']

// The color tokens a group may override. This must equal the keys of the web
// app's default theme (`baseTheme.light` in apps/web/src/themes/index.js); a web
// unit test (apps/web/src/util/groupTheme.test.js) fails if they drift apart.
export const GROUP_THEME_TOKENS = [
  'darkening',
  'background',
  'context-menu-background',
  'midground',
  'foreground',
  'selected',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'error',
  'error-foreground',
  'focus',
  'border',
  'input',
  'ring',
  'theme-background',
  'theme-highlight',
  'chats',
  'discussions',
  'events',
  'offers',
  'projects',
  'proposals',
  'requests',
  'resources',
  'members'
]

// Corner radius choices. `lg` matches the app's current fixed radius.
export const GROUP_THEME_RADII = {
  none: '0rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.875rem'
}

// Border width choices, applied wherever the app draws its standard 2px border
// (Tailwind's `border-2` family). `regular` matches the app's current width.
// Hairline 1px borders are not affected, and there is no "none": inputs, cards
// and selected states rely on a visible border.
export const GROUP_THEME_BORDER_WIDTHS = {
  thin: '1px',
  regular: '2px',
  thick: '3px'
}

const HSL_TRIPLE = /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Parses a token value like '145 50% 62%' into [h, s, l], or null if it is not
 * a plain HSL triple within range.
 */
export function parseHslTriple (value) {
  if (typeof value !== 'string') return null
  const match = HSL_TRIPLE.exec(value.trim())
  if (!match) return null
  const [h, s, l] = match.slice(1).map(Number)
  if (h > 360 || s > 100 || l > 100) return null
  return [h, s, l]
}

/**
 * Returns a clean theme holding only known tokens with valid values, or null
 * when nothing usable is left. Values come back in canonical form
 * ('120  20%  14% ' becomes '120 20% 14%').
 */
export function sanitizeGroupTheme (raw) {
  if (!raw || typeof raw !== 'object') return null

  const theme = {}
  GROUP_THEME_COLOR_SCHEMES.forEach(scheme => {
    const source = raw[scheme]
    if (!source || typeof source !== 'object') return
    const tokens = {}
    GROUP_THEME_TOKENS.forEach(token => {
      if (!hasOwn(source, token)) return
      const parsed = parseHslTriple(source[token])
      if (parsed) tokens[token] = `${parsed[0]} ${parsed[1]}% ${parsed[2]}%`
    })
    if (Object.keys(tokens).length > 0) theme[scheme] = tokens
  })

  if (hasOwn(GROUP_THEME_RADII, raw.radius)) theme.radius = raw.radius
  if (hasOwn(GROUP_THEME_BORDER_WIDTHS, raw.borderWidth)) theme.borderWidth = raw.borderWidth

  return Object.keys(theme).length > 0 ? theme : null
}

/**
 * Strict check for saving a theme. Unlike sanitizeGroupTheme, which silently
 * drops anything it does not recognise, this lists every part of the input
 * that sanitizing would drop, so the caller can reject it.
 *
 * Returns { theme, errors }:
 * - errors: human-readable problems; empty when the input is acceptable.
 * - theme: the sanitized theme to store (null means "no theme").
 *
 * Normalisation is not an error: a valid value written differently (extra
 * whitespace, '050' for 50, '10.0' for 10) is accepted and stored in the
 * canonical form sanitizeGroupTheme produces. Empty color schemes
 * (`light: {}`) are accepted and omitted. Only data that would be dropped
 * counts as an error.
 */
export function validateGroupTheme (raw) {
  if (raw === null || raw === undefined) return { theme: null, errors: [] }
  if (!isPlainObject(raw)) return { theme: null, errors: ['Theme must be an object'] }

  const errors = []
  Object.keys(raw).forEach(key => {
    if (key === 'radius') {
      if (!hasOwn(GROUP_THEME_RADII, raw.radius)) {
        errors.push(`Unknown radius ${JSON.stringify(raw.radius)}; use one of ${Object.keys(GROUP_THEME_RADII).join(', ')}`)
      }
      return
    }

    if (key === 'borderWidth') {
      if (!hasOwn(GROUP_THEME_BORDER_WIDTHS, raw.borderWidth)) {
        errors.push(`Unknown borderWidth ${JSON.stringify(raw.borderWidth)}; use one of ${Object.keys(GROUP_THEME_BORDER_WIDTHS).join(', ')}`)
      }
      return
    }

    if (!GROUP_THEME_COLOR_SCHEMES.includes(key)) {
      errors.push(`Unknown theme key "${key}"`)
      return
    }

    const tokens = raw[key]
    if (!isPlainObject(tokens)) {
      errors.push(`"${key}" must be an object of tokens`)
      return
    }
    Object.keys(tokens).forEach(token => {
      if (!GROUP_THEME_TOKENS.includes(token)) {
        errors.push(`Unknown token "${token}" in ${key}`)
      } else if (!parseHslTriple(tokens[token])) {
        errors.push(`Invalid value for ${key}.${token}: expected an HSL triple like "120 15% 92%"`)
      }
    })
  })

  return { theme: errors.length > 0 ? null : sanitizeGroupTheme(raw), errors }
}
