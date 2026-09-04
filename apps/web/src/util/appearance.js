import { themes, defaultTheme } from '../themes'
import { WebViewMessageTypes } from '@hylo/shared'
import { sendMessageToWebView } from 'util/webView'

export const DEFAULT_COLOR_SCHEME = 'auto'
export const DEFAULT_GLOBAL_NAV_STYLE = 'sidebar'

// Legacy localStorage keys — used only for one-time migration to user.settings
const LEGACY_THEME_KEY = 'hylo-theme'
const LEGACY_COLOR_SCHEME_KEY = 'hylo-color-scheme'
const LEGACY_GLOBAL_NAV_STYLE_KEY = 'hylo-nav-mode'
const LEGACY_STACK_GROUPS_KEY = 'hylo-stack-groups'

/**
 * Returns normalized color appearance settings from a user.settings object.
 */
export function getAppearanceFromSettings (settings = {}) {
  const theme = themes[settings.theme] ? settings.theme : defaultTheme
  const colorScheme = settings.colorScheme || DEFAULT_COLOR_SCHEME

  return { theme, colorScheme }
}

/**
 * Resolves auto/light/dark to the effective light or dark scheme.
 */
export function resolveEffectiveColorScheme (colorScheme, systemColorScheme) {
  if (colorScheme === 'auto') return systemColorScheme
  return colorScheme === 'dark' ? 'dark' : 'light'
}

/**
 * Reads the current system color scheme preference.
 */
export function getSystemColorScheme () {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Applies theme CSS variables and document color-scheme classes.
 */
export function applyAppearanceToDocument (themeName, effectiveColorScheme) {
  const theme = themes[themeName]?.[effectiveColorScheme] || themes[defaultTheme][effectiveColorScheme]

  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value)
  })

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(effectiveColorScheme)
  document.documentElement.style.colorScheme = effectiveColorScheme

  sendMessageToWebView(WebViewMessageTypes.THEME_CHANGE, {
    themeName,
    colorScheme: effectiveColorScheme
  })
}

/**
 * Builds a settings patch from legacy localStorage values when DB fields are unset.
 * Clears migrated localStorage keys. Returns null when nothing to migrate.
 * TODO: can remove this once we've migrated all users
 */
export function buildLegacyAppearanceMigration (settings = {}) {
  if (typeof window === 'undefined') return null

  const patch = {}

  if (settings.theme == null) {
    const stored = window.localStorage.getItem(LEGACY_THEME_KEY)
    if (stored && themes[stored]) patch.theme = stored
  }

  if (settings.colorScheme == null) {
    const stored = window.localStorage.getItem(LEGACY_COLOR_SCHEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      patch.colorScheme = stored
    }
  }

  if (settings.globalNavStyle == null) {
    const stored = window.localStorage.getItem(LEGACY_GLOBAL_NAV_STYLE_KEY)
    if (stored === 'tabs' || stored === 'sidebar') patch.globalNavStyle = stored
  }

  if (settings.stackGroups == null) {
    const stored = window.localStorage.getItem(LEGACY_STACK_GROUPS_KEY)
    if (stored === 'true' || stored === 'false') {
      patch.stackGroups = stored === 'true'
    }
  }

  if (Object.keys(patch).length === 0) return null

  const legacyKeys = [LEGACY_THEME_KEY, LEGACY_COLOR_SCHEME_KEY, LEGACY_GLOBAL_NAV_STYLE_KEY, LEGACY_STACK_GROUPS_KEY]
  legacyKeys.forEach(key => {
    try { window.localStorage.removeItem(key) } catch (e) {}
  })

  return patch
}

export const availableThemes = Object.keys(themes)
