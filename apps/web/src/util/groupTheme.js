import { loadGoogleFont } from './googleFonts'
import { GROUP_THEME_BORDER_WIDTHS, GROUP_THEME_FONT_KEYS, isGroupThemeFontFamily, GROUP_THEME_RADII, GROUP_THEME_TOKENS, parseHslTriple, sanitizeGroupTheme, validateGroupTheme } from '@hylo/shared'
import { themes, defaultTheme } from '../themes'

/**
 * Group themes (proof of concept).
 *
 * A group can store a theme at `group.settings.theme`:
 *
 *   {
 *     light: { background: '120 15% 92%', accent: '43 74% 49%', ... },
 *     dark:  { background: '120 20% 14%', ... },
 *     radius: 'lg',
 *     borderWidth: 'regular'
 *   }
 *
 * Only design tokens are stored, never CSS. Everything read from storage goes
 * through sanitizeGroupTheme, so a bad or hostile value can never reach the
 * page as a style. The validation rules live in @hylo/shared (GroupThemeHelpers).
 */

// Validation rules are shared with the backend, which validates on save.
export { GROUP_THEME_TOKENS, GROUP_THEME_RADII, GROUP_THEME_BORDER_WIDTHS, GROUP_THEME_FONT_KEYS, isGroupThemeFontFamily, parseHslTriple, sanitizeGroupTheme, validateGroupTheme }

export const DEFAULT_RADIUS = GROUP_THEME_RADII.lg
export const DEFAULT_BORDER_WIDTH = GROUP_THEME_BORDER_WIDTHS.regular
// The app's own font; css/global/index.scss falls back to the same family
export const DEFAULT_FONT_FAMILY = 'Onest'

const fontValue = family => `'${family || DEFAULT_FONT_FAMILY}'`

/**
 * Starts loading the Google Fonts a theme uses. Safe to call repeatedly.
 */
export function loadGroupThemeFonts (rawTheme) {
  const theme = sanitizeGroupTheme(rawTheme)
  if (!theme) return
  GROUP_THEME_FONT_KEYS.forEach(key => { if (theme[key]) loadGoogleFont(theme[key]) })
}

// Text-on-surface pairs that must stay readable, as [text token, surface token]
export const CONTRAST_PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'midground'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'muted'],
  ['destructive-foreground', 'destructive']
]

// WCAG AA for normal-size text
export const MIN_CONTRAST_RATIO = 4.5

const WHITE = '0 0% 100%'

// Colors the app uses as text as well as fills. Each gets a `--<token>-text`
// variable that tailwind.config.js reads for text-<token>.
export const TEXT_COLOR_TOKENS = ['selected', 'accent', 'focus']

/**
 * The full set of tokens a themed group shows for a color scheme: the app's
 * default theme with the group's overrides on top.
 *
 * A group theme always sits on the default theme, never on the viewer's
 * personal theme. Otherwise a group that changes only its background would be
 * paired with a different text color for every member, and its contrast could
 * not be checked.
 */
export function resolveGroupThemeTokens (theme, colorScheme) {
  const scheme = colorScheme === 'dark' ? 'dark' : 'light'
  return { ...themes[defaultTheme][scheme], ...(theme?.[scheme] || {}) }
}

/**
 * CSS custom properties for a themed group, ready to set on an element.
 * Returns null when the group has no usable theme.
 */
export function groupThemeCssVars (rawTheme, colorScheme) {
  const theme = sanitizeGroupTheme(rawTheme)
  if (!theme) return null

  const vars = {}
  const scheme = colorScheme === 'dark' ? 'dark' : 'light'
  const tokens = resolveGroupThemeTokens(theme, scheme)
  Object.entries(tokens).forEach(([token, value]) => {
    vars[`--${token}`] = value
  })
  // The colors used as text get a readable version of whatever the group chose.
  // Only the group's own choices are adjusted, so the default theme looks the
  // same inside a themed group as outside one.
  TEXT_COLOR_TOKENS.forEach(token => {
    const chosen = theme[scheme] && token in theme[scheme]
    vars[`--${token}-text`] = chosen ? readableTextColor(tokens[token], [tokens.card, tokens.background]) : tokens[token]
  })
  vars['--radius'] = GROUP_THEME_RADII[theme.radius] || DEFAULT_RADIUS
  vars['--border-width'] = GROUP_THEME_BORDER_WIDTHS[theme.borderWidth] || DEFAULT_BORDER_WIDTH
  vars['--font-body'] = fontValue(theme.fontBody)
  // Headings follow the body font unless the group chose one for them
  vars['--font-display'] = fontValue(theme.fontHeading || theme.fontBody)
  return vars
}

/**
 * CSS custom properties that restore one of the app's own themes on an element,
 * used to keep the global nav in the viewer's theme inside a themed group.
 */
export function appThemeCssVars (themeName, colorScheme) {
  const scheme = colorScheme === 'dark' ? 'dark' : 'light'
  const tokens = themes[themeName]?.[scheme] || themes[defaultTheme][scheme]
  const vars = {}
  Object.entries(tokens).forEach(([token, value]) => {
    vars[`--${token}`] = value
  })
  // Undo a group theme's adjusted text colors (see groupThemeCssVars)
  TEXT_COLOR_TOKENS.forEach(token => { vars[`--${token}-text`] = tokens[token] })
  vars['--radius'] = DEFAULT_RADIUS
  vars['--border-width'] = DEFAULT_BORDER_WIDTH
  vars['--font-body'] = fontValue()
  vars['--font-display'] = fontValue()
  return vars
}

function hslToRgb ([h, s, l]) {
  const sat = s / 100
  const light = l / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1))
  const m = light - chroma / 2
  let rgb
  if (h < 60) rgb = [chroma, x, 0]
  else if (h < 120) rgb = [x, chroma, 0]
  else if (h < 180) rgb = [0, chroma, x]
  else if (h < 240) rgb = [0, x, chroma]
  else if (h < 300) rgb = [x, 0, chroma]
  else rgb = [chroma, 0, x]
  return rgb.map(channel => channel + m)
}

function relativeLuminance (hsl) {
  const [r, g, b] = hslToRgb(hsl).map(channel =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG contrast ratio (1 to 21) between two HSL triple strings, or null if
 * either is not a valid triple.
 */
export function contrastRatio (a, b) {
  const first = parseHslTriple(a)
  const second = parseHslTriple(b)
  if (!first || !second) return null
  const lumA = relativeLuminance(first)
  const lumB = relativeLuminance(second)
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05)
}

/**
 * A color that reads as text on every given surface: the same hue and
 * saturation, made darker on light surfaces or lighter on dark ones only as far
 * as the minimum contrast needs. Returns the color unchanged when it already
 * reads, or when any value is not a valid HSL triple.
 *
 * `selected`, `accent` and `focus` are used both as fills and as text
 * (text-selected and so on, see tailwind.config.js). A group is free to pick a
 * pale fill, which would otherwise make that text unreadable.
 */
export function readableTextColor (color, surfaces, minRatio = MIN_CONTRAST_RATIO) {
  const parsed = parseHslTriple(color)
  const valid = (surfaces || []).filter(surface => parseHslTriple(surface))
  if (!parsed || valid.length === 0) return color

  const reads = candidate => valid.every(surface => contrastRatio(candidate, surface) >= minRatio)
  if (reads(color)) return color

  const [h, s, l] = parsed
  const triple = lightness => `${h} ${s}% ${Math.round(lightness * 10) / 10}%`
  // Move away from the surfaces: darker when they are light, lighter when dark
  const lightSurfaces = valid.reduce((sum, surface) => sum + relativeLuminance(parseHslTriple(surface)), 0) / valid.length > 0.18
  const step = lightSurfaces ? -1 : 1
  for (let lightness = l + step; lightness >= 0 && lightness <= 100; lightness += step) {
    if (reads(triple(lightness))) return triple(lightness)
  }
  return triple(lightSurfaces ? 0 : 100)
}

/**
 * Lists the text/surface pairs of a group theme that fall below the minimum
 * contrast in a color scheme. Only pairs the group changed are reported, so
 * the result is about the group's choices and not about the default theme.
 */
export function checkGroupThemeContrast (rawTheme, colorScheme, minRatio = MIN_CONTRAST_RATIO) {
  const theme = sanitizeGroupTheme(rawTheme)
  if (!theme) return []

  const scheme = colorScheme === 'dark' ? 'dark' : 'light'
  const overrides = theme[scheme] || {}
  const tokens = resolveGroupThemeTokens(theme, scheme)

  const pairs = CONTRAST_PAIRS
    .filter(([text, surface]) => text in overrides || surface in overrides)
    .map(([text, surface]) => ({ text, surface, ratio: contrastRatio(tokens[text], tokens[surface]) }))

  // Banner scrims are made from `darkening` and always carry white text
  if ('darkening' in overrides) {
    pairs.push({ text: 'white', surface: 'darkening', ratio: contrastRatio(WHITE, tokens.darkening) })
  }

  return pairs
    .filter(({ ratio }) => ratio !== null && ratio < minRatio)
    .map(pair => ({ ...pair, ratio: Math.round(pair.ratio * 100) / 100, colorScheme: scheme }))
}
