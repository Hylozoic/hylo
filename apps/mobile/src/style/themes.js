/**
 * Theme color definitions for native safe area insets and status bar styling.
 *
 * Colors are sourced from the web app's theme definitions:
 *   apps/web/src/themes/index.js
 *
 * Only the `background` and `foreground` HSL values are included here
 * because they are the only ones needed outside the WebView (for SafeAreaView
 * background and StatusBar styling). All other theme colors are applied
 * inside the WebView by the web app's ThemeContext.
 *
 * If a theme is added or modified in the web app, update this file to match.
 */

/**
 * Converts an HSL string (e.g. '39 20% 88%') to a hex color string.
 */
export function hslToHex(hslString) {
  const parts = hslString.replace(/%/g, '').split(/\s+/).map(Number)
  const h = parts[0]
  const s = parts[1] / 100
  const l = parts[2] / 100

  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Theme definitions — background and foreground HSL values per theme/variant.
// Mirrors apps/web/src/themes/index.js
const themeColors = {
  default: {
    light: { background: '39 20% 88%', foreground: '166 10% 3.9%' },
    dark: { background: '39 3% 18%', foreground: '40 100% 99%' }
  },
  stone: {
    light: { background: '0 0% 92%', foreground: '0 0% 10%' },
    dark: { background: '0 0% 13%', foreground: '0 0% 92%' }
  },
  forest: {
    light: { background: '120 15% 92%', foreground: '95 10% 10%' },
    dark: { background: '120 20% 14%', foreground: '95 10% 90%' }
  },
  ocean: {
    light: { background: '187 16% 92%', foreground: '200 30% 10%' },
    dark: { background: '187 25% 14%', foreground: '187 10% 90%' }
  },
  desert: {
    light: { background: '35 50% 92%', foreground: '35 35% 10%' },
    dark: { background: '25 14% 14%', foreground: '42 10% 90%' }
  },
  snow: {
    light: { background: '210 10% 95%', foreground: '210 20% 10%' },
    dark: { background: '210 15% 15%', foreground: '210 10% 95%' }
  },
  jungle: {
    light: { background: '155 35% 92%', foreground: '150 45% 10%' },
    dark: { background: '150 40% 12%', foreground: '150 10% 90%' }
  },
  blossom: {
    light: { background: '270 25% 93%', foreground: '270 25% 12%' },
    dark: { background: '270 22% 15%', foreground: '270 15% 92%' }
  },
  fall: {
    light: { background: '25 55% 90%', foreground: '12 35% 12%' },
    dark: { background: '5 35% 16%', foreground: '35 20% 90%' }
  }
}

export const DEFAULT_THEME = 'default'
export const DEFAULT_COLOR_SCHEME = 'light'

/**
 * Returns resolved hex colors for a given theme name and color scheme.
 *
 * @param {string} themeName - One of the theme keys (e.g. 'forest', 'ocean')
 * @param {string} colorScheme - 'light' or 'dark'
 * @returns {{ backgroundColor: string, foregroundColor: string }}
 */
export function getThemeColors(themeName = DEFAULT_THEME, colorScheme = DEFAULT_COLOR_SCHEME) {
  const theme = themeColors[themeName] || themeColors[DEFAULT_THEME]
  const variant = theme[colorScheme] || theme[DEFAULT_COLOR_SCHEME]

  return {
    backgroundColor: hslToHex(variant.background),
    foregroundColor: hslToHex(variant.foreground)
  }
}

export default themeColors

