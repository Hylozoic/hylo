import {
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  normalizeLocaleToFull
} from '@hylo/shared'

export { normalizeLocaleToFull, localeToTranslationKey } from '@hylo/shared'

export function localeToFlagEmoji (locale = LOCALE_EN_US) {
  switch (normalizeLocaleToFull(locale)) {
    case LOCALE_EN_GB:
      return '🇬🇧'
    case LOCALE_EN_US:
      return '🇺🇸'
    case LOCALE_ES:
      return '🇪🇸'
    case LOCALE_DE:
      return '🇩🇪'
    case LOCALE_FR:
      return '🇫🇷'
    case LOCALE_HI:
      return '🇮🇳'
    case LOCALE_PT:
      return '🇵🇹'
    default:
      return '🇺🇸'
  }
}

export function localeToWord (locale = LOCALE_EN_US) {
  switch (normalizeLocaleToFull(locale)) {
    case LOCALE_EN_GB:
      return 'English (UK)'
    case LOCALE_EN_US:
      return 'English'
    case LOCALE_ES:
      return 'Spanish'
    case LOCALE_DE:
      return 'German'
    case LOCALE_FR:
      return 'French'
    case LOCALE_HI:
      return 'Hindi'
    case LOCALE_PT:
      return 'Portuguese'
    default:
      return 'English'
  }
}

/** Returns the BCP 47 locale tag for Luxon/Intl date formatting from the user's Hylo language setting. */
export function getDateLocale () {
  return normalizeLocaleToFull(getLocaleFromLocalStorage())
}

/**
 * BCP 47 locale for formatting dates, times and money: the user's Hylo language, refined by the
 * browser's region when the browser prefers the same language. Hylo only stores one locale per
 * language (en-AU becomes en-US), so with Hylo set to English and a browser set to en-AU this
 * returns en-AU (day-first dates, 12-hour times), while with Hylo set to German it stays de-DE.
 * A region picked in Hylo that isn't its language's default (English (UK), pt-PT) is kept.
 */
export function getRegionalLocale (appLocale = getLocaleFromLocalStorage()) {
  const locale = normalizeLocaleToFull(appLocale)
  const language = locale.split('-')[0]
  if (normalizeLocaleToFull(language) !== locale || typeof navigator === 'undefined') return locale

  const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language]
  const match = browserLocales.find(l => typeof l === 'string' && l.includes('-') && l.split('-')[0].toLowerCase() === language)
  if (!match) return locale
  try {
    return Intl.getCanonicalLocales(match)[0]
  } catch (e) {
    return locale
  }
}

export function getLocaleFromLocalStorage (locale) {
  if (typeof window === 'undefined') return LOCALE_EN_US

  if (locale) {
    const normalized = normalizeLocaleToFull(locale)
    window.localStorage.setItem('hylo-i18n-lng', normalized)
    return normalized
  }

  const stored = window.localStorage.getItem('hylo-i18n-lng')
  const normalized = normalizeLocaleToFull(stored || LOCALE_EN_US)
  if (stored && stored !== normalized) {
    window.localStorage.setItem('hylo-i18n-lng', normalized)
  }
  return normalized
}
