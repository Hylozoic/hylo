// Mirror of packages/shared/src/LocaleHelpers.js for backend use without requiring a shared dist rebuild.
const LOCALE_EN_US = 'en-US'
const LOCALE_EN_GB = 'en-GB'
const LOCALE_ES = 'es-ES'
const LOCALE_DE = 'de-DE'
const LOCALE_FR = 'fr-FR'
const LOCALE_HI = 'hi-IN'
const LOCALE_PT = 'pt-BR'

const FULL_LOCALE_LOOKUP = {
  en: LOCALE_EN_US,
  'en-US': LOCALE_EN_US,
  'en-GB': LOCALE_EN_GB,
  es: LOCALE_ES,
  'es-ES': LOCALE_ES,
  de: LOCALE_DE,
  'de-DE': LOCALE_DE,
  fr: LOCALE_FR,
  'fr-FR': LOCALE_FR,
  hi: LOCALE_HI,
  'hi-IN': LOCALE_HI,
  pt: LOCALE_PT,
  'pt-BR': LOCALE_PT,
  'pt-PT': 'pt-PT'
}

function normalizeLocaleToFull (locale) {
  if (!locale || typeof locale !== 'string') return LOCALE_EN_US
  if (FULL_LOCALE_LOOKUP[locale]) return FULL_LOCALE_LOOKUP[locale]

  const short = locale.split('-')[0]
  if (FULL_LOCALE_LOOKUP[short]) return FULL_LOCALE_LOOKUP[short]

  if (locale.includes('-')) return locale

  return LOCALE_EN_US
}

function localeToTranslationKey (locale) {
  const full = normalizeLocaleToFull(locale)
  if (full.startsWith('en')) return 'en'
  return full.split('-')[0]
}

module.exports = {
  LOCALE_EN_US,
  LOCALE_EN_GB,
  LOCALE_ES,
  LOCALE_DE,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  normalizeLocaleToFull,
  localeToTranslationKey
}
