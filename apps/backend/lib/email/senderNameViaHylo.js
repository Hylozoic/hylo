const { getLocaleStrings } = require('../i18n/locales')

// Align with recipient locales stored on users / Sendwithus (en-US, es-ES, …).
const RECIPIENT_LOCALE_TO_I18N = {
  'en-US': 'en',
  'es-ES': 'es',
  'de-DE': 'de',
  'fr-FR': 'fr',
  'hi-IN': 'hi',
  'pt-BR': 'pt',
  'pt-PT': 'pt'
}

/**
 * Maps user/Sendwithus locale strings to `lib/i18n` keys.
 */
function recipientLocaleToI18nKey (locale) {
  if (!locale || typeof locale !== 'string') return 'en'
  if (RECIPIENT_LOCALE_TO_I18N[locale]) return RECIPIENT_LOCALE_TO_I18N[locale]
  const short = locale.split('-')[0]
  if (['en', 'es', 'fr', 'de', 'hi', 'pt'].includes(short)) return short
  return 'en'
}

/**
 * True if the display name already ends with a Hylo relay parenthetical (any locale).
 */
function alreadyHasViaHyloSuffix (displayName) {
  return /\([^)]*\bHylo\b[^)]*\)\s*$/i.test(displayName.trim())
}

/**
 * From-display name when Hylo relays a person, group, or entity for this recipient’s locale.
 * Uses `emailSenderViaHyloSuffix` from `lib/i18n`. Idempotent if a Hylo parenthetical is already present.
 *
 * @param {string} displayName
 * @param {string} [recipientLocale] reader/recipient locale (e.g. en, en-US, es-ES)
 */
function senderNameViaHylo (displayName, recipientLocale) {
  if (displayName == null || typeof displayName !== 'string') return displayName
  const t = displayName.trim()
  if (!t) return displayName
  if (alreadyHasViaHyloSuffix(t)) return t

  const L = getLocaleStrings(recipientLocaleToI18nKey(recipientLocale))
  const suffix = typeof L.emailSenderViaHyloSuffix === 'function'
    ? L.emailSenderViaHyloSuffix()
    : ' (via Hylo)'

  return `${t}${suffix}`
}

module.exports = {
  senderNameViaHylo,
  recipientLocaleToI18nKey
}
