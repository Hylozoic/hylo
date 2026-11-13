import { isEqual } from 'lodash'
import { themes, defaultTheme } from '../themes'
import {
  GROUP_THEME_BORDER_WIDTHS,
  GROUP_THEME_FONT_KEYS,
  isGroupThemeFontFamily,
  GROUP_THEME_RADII,
  GROUP_THEME_TOKENS,
  checkGroupThemeContrast,
  contrastRatio,
  MIN_CONTRAST_RATIO,
  parseHslTriple,
  resolveGroupThemeTokens,
  sanitizeGroupTheme,
  validateGroupTheme
} from './groupTheme'

/**
 * Pure logic behind the group theme editor (Group Settings > Appearance).
 *
 * A draft is shaped exactly like a stored group theme ({ light, dark, radius, borderWidth, fontBody, fontHeading }),
 * so it can be previewed with groupThemeCssVars and saved as is. Stewards edit
 * six roles; every other token a role touches is derived from the roles.
 */

export const COLOR_SCHEMES = ['light', 'dark']

export const RADIUS_OPTIONS = Object.keys(GROUP_THEME_RADII)
export const DEFAULT_RADIUS_OPTION = 'lg'

export const BORDER_WIDTH_OPTIONS = Object.keys(GROUP_THEME_BORDER_WIDTHS)
export const DEFAULT_BORDER_WIDTH_OPTION = 'regular'

// The token that holds each role's own color
export const ROLE_TOKENS = {
  background: 'background',
  card: 'card',
  text: 'foreground',
  primary: 'primary',
  accent: 'accent',
  selected: 'selected'
}

export const THEME_ROLES = Object.keys(ROLE_TOKENS)

// The tokens that are recalculated when a role changes
export const ROLE_DEPENDENTS = {
  background: ['background', 'midground', 'context-menu-background', 'muted', 'border', 'muted-foreground'],
  card: ['card', 'popover', 'input', 'midground', 'context-menu-background', 'muted', 'muted-foreground'],
  text: ['foreground', 'card-foreground', 'popover-foreground', 'ring', 'border', 'muted-foreground', 'primary-foreground'],
  primary: ['primary', 'primary-foreground'],
  accent: ['accent', 'accent-foreground'],
  selected: ['selected']
}

// Which role to show a contrast warning next to, by the pair's surface token
const SURFACE_ROLES = {
  background: 'background',
  midground: 'background',
  muted: 'background',
  card: 'card',
  popover: 'card',
  primary: 'primary',
  accent: 'accent'
}

/**
 * Save policy for contrast failures, kept in one place so it is easy to change.
 * Product has not decided yet whether failures block saving; for now they do,
 * unless the steward ticks an explicit "save anyway" override.
 */
export const CONTRAST_FAILURES_BLOCK_SAVE = true

export function canSaveWithContrastIssues ({ issueCount, override }) {
  if (!CONTRAST_FAILURES_BLOCK_SAVE) return true
  return issueCount === 0 || !!override
}

const WHITE = '0 0% 100%'
const BLACK = '0 0% 0%'

function formatTriple ([h, s, l]) {
  return `${h} ${s}% ${l}%`
}

function hslToRgb ([h, s, l]) {
  const sat = s / 100
  const light = l / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const hue = (h % 360) / 60
  const x = chroma * (1 - Math.abs(hue % 2 - 1))
  const m = light - chroma / 2
  let rgb
  if (hue < 1) rgb = [chroma, x, 0]
  else if (hue < 2) rgb = [x, chroma, 0]
  else if (hue < 3) rgb = [0, chroma, x]
  else if (hue < 4) rgb = [0, x, chroma]
  else if (hue < 5) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]
  return rgb.map(channel => Math.min(1, Math.max(0, channel + m)))
}

function rgbToHsl ([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  const delta = max - min
  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * light - 1))
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360
  // One decimal place is fine enough that hex colors survive a round trip
  const round = value => Math.round(value * 10) / 10
  return [round(h) % 360, Math.min(100, round(s * 100)), Math.min(100, round(light * 100))]
}

/**
 * '#3a7bd5' (or '#abc') to a plain HSL triple like '215 64% 53%', or null.
 */
export function hexToHslTriple (hex) {
  if (typeof hex !== 'string') return null
  let digits = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(digits)) digits = digits.split('').map(d => d + d).join('')
  if (!/^[0-9a-f]{6}$/i.test(digits)) return null
  const rgb = [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16) / 255)
  return formatTriple(rgbToHsl(rgb))
}

/**
 * A plain HSL triple to '#rrggbb', for a native color input, or null.
 */
export function hslTripleToHex (triple) {
  const hsl = parseHslTriple(triple)
  if (!hsl) return null
  return '#' + hslToRgb(hsl)
    .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Mixes two HSL triples in RGB space; amount 0 gives `from`, 1 gives `to`.
 */
export function mixHslTriples (from, to, amount) {
  const a = parseHslTriple(from)
  const b = parseHslTriple(to)
  if (!a || !b) return from
  const rgbA = hslToRgb(a)
  const rgbB = hslToRgb(b)
  return formatTriple(rgbToHsl(rgbA.map((channel, i) => channel + (rgbB[i] - channel) * amount)))
}

// A text color for a surface: the preferred one if it is readable, else black or white
function readableOn (surface, preferred) {
  if (preferred && contrastRatio(preferred, surface) >= MIN_CONTRAST_RATIO) return preferred
  return contrastRatio(WHITE, surface) >= contrastRatio(BLACK, surface) ? WHITE : BLACK
}

// Moves `color` toward `target` until it is readable on `surface`
function withContrast (color, surface, target) {
  for (let step = 0; step <= 10; step++) {
    const candidate = step === 0 ? color : mixHslTriples(color, target, step / 10)
    if (contrastRatio(candidate, surface) >= MIN_CONTRAST_RATIO) return candidate
  }
  return target
}

/**
 * The tokens the six roles produce, for one color scheme.
 */
export function deriveTokensFromRoles ({ background, card, text, primary, accent, selected }) {
  const muted = mixHslTriples(background, card, 0.3)
  return {
    background,
    midground: mixHslTriples(background, card, 0.5),
    'context-menu-background': mixHslTriples(background, card, 0.6),
    muted,
    border: mixHslTriples(background, text, 0.12),
    card,
    popover: card,
    input: card,
    foreground: text,
    'card-foreground': text,
    'popover-foreground': text,
    ring: text,
    'muted-foreground': withContrast(mixHslTriples(text, background, 0.45), muted, text),
    primary,
    'primary-foreground': readableOn(primary, text),
    accent,
    'accent-foreground': readableOn(accent, WHITE),
    selected
  }
}

/**
 * The current color of each role in a draft, falling back to the default theme.
 */
export function getRoleColors (draft, scheme) {
  const tokens = resolveGroupThemeTokens(draft, scheme)
  const roles = {}
  THEME_ROLES.forEach(role => { roles[role] = tokens[ROLE_TOKENS[role]] })
  return roles
}

/**
 * A new draft with one role changed in one scheme and the tokens that depend
 * on it recalculated. Other tokens (from a preset, say) are left alone.
 */
export function setRoleColor (draft, scheme, role, triple) {
  if (!ROLE_TOKENS[role] || !parseHslTriple(triple)) return draft
  const roles = { ...getRoleColors(draft, scheme), [role]: triple }
  const derived = deriveTokensFromRoles(roles)
  const changes = {}
  ROLE_DEPENDENTS[role].forEach(token => { changes[token] = derived[token] })
  return {
    ...(draft || {}),
    [scheme]: { ...(draft?.[scheme] || {}), ...changes }
  }
}

export function setRadius (draft, radius) {
  if (!GROUP_THEME_RADII[radius]) return draft
  return { ...(draft || {}), radius }
}

export function setBorderWidth (draft, borderWidth) {
  if (!GROUP_THEME_BORDER_WIDTHS[borderWidth]) return draft
  return { ...(draft || {}), borderWidth }
}

/**
 * Sets the body or heading font ('fontBody' or 'fontHeading') to a Google
 * Fonts family, or clears it when no family is given.
 */
export function setFont (draft, key, family) {
  if (!GROUP_THEME_FONT_KEYS.includes(key)) return draft
  const next = { ...(draft || {}) }
  if (!family) {
    delete next[key]
  } else if (isGroupThemeFontFamily(family)) {
    next[key] = family
  }
  return next
}

/**
 * The parts of a draft that are not colors (radius, border width, fonts), to
 * carry over when the colors are replaced by a preset.
 */
export function nonColorSettings (draft) {
  const kept = {}
  ;['radius', 'borderWidth', ...GROUP_THEME_FONT_KEYS].forEach(key => {
    if (draft?.[key]) kept[key] = draft[key]
  })
  return kept
}

export const PRESET_NAMES = Object.keys(themes)

/**
 * A draft holding one of the app's own themes: the tokens where it differs from
 * the default theme, with the text on primary, secondary, accent and muted
 * surfaces adjusted wherever it would fail the contrast check.
 * Has colors only; the caller keeps the current radius, border width and fonts.
 */
export function presetToDraft (themeName) {
  const preset = themes[themeName]
  if (!preset || themeName === defaultTheme) return {}
  const draft = {}
  COLOR_SCHEMES.forEach(scheme => {
    const base = themes[defaultTheme][scheme]
    const source = preset[scheme] || {}
    const tokens = {}
    GROUP_THEME_TOKENS.forEach(token => {
      const value = source[token]
      if (value !== undefined && value !== base[token] && parseHslTriple(value)) tokens[token] = value
    })
    // The presets were designed for members' own use; make sure their text stays readable
    const resolved = { ...base, ...tokens }
    const readable = {
      'primary-foreground': readableOn(resolved.primary, resolved.foreground),
      'secondary-foreground': readableOn(resolved.secondary, resolved['secondary-foreground']),
      'accent-foreground': readableOn(resolved.accent, WHITE),
      'muted-foreground': withContrast(resolved['muted-foreground'], resolved.muted, resolved.foreground)
    }
    Object.entries(readable).forEach(([token, value]) => {
      if (value !== resolved[token]) tokens[token] = value
    })
    const sanitized = sanitizeGroupTheme({ [scheme]: tokens })
    if (sanitized?.[scheme]) draft[scheme] = sanitized[scheme]
  })
  return draft
}

/**
 * Drops everything that matches the default theme, so the stored theme holds
 * only real overrides. Returns null when nothing is left (the default look).
 */
export function compactTheme (draft) {
  const theme = sanitizeGroupTheme(draft)
  if (!theme) return null
  const result = {}
  COLOR_SCHEMES.forEach(scheme => {
    const base = themes[defaultTheme][scheme]
    const tokens = {}
    Object.entries(theme[scheme] || {}).forEach(([token, value]) => {
      if (!isEqual(parseHslTriple(value), parseHslTriple(base[token]))) tokens[token] = value
    })
    if (Object.keys(tokens).length > 0) result[scheme] = tokens
  })
  if (theme.radius && theme.radius !== DEFAULT_RADIUS_OPTION) result.radius = theme.radius
  if (theme.borderWidth && theme.borderWidth !== DEFAULT_BORDER_WIDTH_OPTION) result.borderWidth = theme.borderWidth
  GROUP_THEME_FONT_KEYS.forEach(key => {
    if (theme[key]) result[key] = theme[key]
  })
  return Object.keys(result).length > 0 ? result : null
}

/**
 * The theme to send to the server for a draft, and whether it is safe to send:
 * only a theme that sanitizeGroupTheme returns unchanged (or null) may be saved.
 */
export function prepareThemeForSave (draft) {
  const theme = compactTheme(draft)
  // The same check the server makes, plus: sanitizing must not change anything
  const valid = theme === null ||
    (validateGroupTheme(theme).errors.length === 0 && isEqual(sanitizeGroupTheme(theme), theme))
  return { theme, valid }
}

/**
 * The editable draft for a saved theme (an empty draft when there is none).
 */
export function draftFromSavedTheme (saved) {
  return sanitizeGroupTheme(saved) || {}
}

export function themesMatch (a, b) {
  return isEqual(compactTheme(a), compactTheme(b))
}

/**
 * Contrast failures of a draft for both color schemes.
 */
export function getContrastIssues (draft) {
  return {
    light: checkGroupThemeContrast(draft, 'light'),
    dark: checkGroupThemeContrast(draft, 'dark')
  }
}

/**
 * The role a contrast failure should be shown next to, or null when the pair
 * is not about one of the editable roles (e.g. an override from a preset).
 */
export function roleForContrastIssue ({ surface }) {
  return SURFACE_ROLES[surface] || null
}
