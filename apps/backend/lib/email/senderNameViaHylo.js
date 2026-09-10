const { getLocaleStrings } = require('../i18n/locales')

// Align with recipient locales stored on users / Sendwithus (en-US, es-ES, …).
const RECIPIENT_LOCALE_TO_I18N = {
  'en-US': 'en',
  'en-GB': 'en',
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
 * Label for a group in email From: names and similar. Spaces include the parent: "Parent > Space".
 *
 * @param {object} group Bookshelf Group (or mock with `.get`)
 * @returns {string|null}
 */
function groupDisplayNameWithParent (group) {
  if (!group) return null
  const name = group.get('name')
  if (group.get('type') !== 'space') return name
  const parent = group.relations?.parentGroup ||
    (typeof group.related === 'function' ? group.related('parentGroup') : null)
  const parentName = parent && typeof parent.get === 'function' ? parent.get('name') : null
  if (!parentName) return name
  return `${parentName} > ${name}`
}

/**
 * Loads parentGroup on a space when nested withRelated is empty.
 *
 * @param {object} group Bookshelf Group
 * @returns {Promise<object>}
 */
async function ensureGroupParent (group) {
  if (!group || group.get('type') !== 'space') return group
  const loaded = group.relations?.parentGroup
  if (loaded && loaded.get('name')) return group
  const parentId = group.get('parent_id')
  if (!parentId) return group
  const parent = await Group.find(parentId)
  if (parent) group.relations.parentGroup = parent
  return group
}

/**
 * From-display name when the email is sent on behalf of a group or space.
 *
 * @param {object} group Bookshelf Group
 * @param {string} [recipientLocale]
 * @returns {Promise<string>}
 */
async function senderNameForGroup (group, recipientLocale) {
  await ensureGroupParent(group)
  return senderNameViaHylo(groupDisplayNameWithParent(group), recipientLocale)
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
  senderNameForGroup,
  groupDisplayNameWithParent,
  ensureGroupParent,
  recipientLocaleToI18nKey
}
