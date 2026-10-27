/** Backend error code: a destination refuses the post type (extensions: { postType, destinations }). */
export const POST_TYPE_NOT_ACCEPTED = 'POST_TYPE_NOT_ACCEPTED'

/**
 * Translated label for a post type, using the app's existing post-type keys.
 * Literal t() calls keep the keys visible to i18next-extract.
 * @param {Function} t
 * @param {string} postType
 * @returns {string}
 */
function postTypeLabel (t, postType) {
  const labels = {
    discussion: t('discussion'),
    event: t('event'),
    offer: t('offer'),
    project: t('project'),
    proposal: t('proposal'),
    request: t('request'),
    resource: t('resource')
  }
  return labels[postType] || postType
}

/**
 * Joins items as a list in the given language ("A and B", "A, B und C"),
 * falling back to a comma join when Intl.ListFormat is unavailable.
 * @param {string[]} items
 * @param {string} [language]
 * @returns {string}
 */
export function formatList (items, language) {
  try {
    if (typeof Intl !== 'undefined' && Intl.ListFormat) {
      return new Intl.ListFormat(language || undefined, { style: 'long', type: 'conjunction' }).format(items)
    }
  } catch (e) {
    // Unknown locale tag: fall through to the plain join
  }
  return items.join(', ')
}

/**
 * Text to show when saving a post fails. A post-type rejection is built from the
 * server's structured data in the user's language; any other error shows the
 * server's message, or a generic message if there is none.
 * @param {Error|Object} error - Rejected action payload (GraphQL error fields copied on)
 * @param {Function} t - i18next t
 * @param {string} [language] - Current i18n language, for list formatting
 * @returns {string}
 */
export default function postSaveErrorMessage (error, t, language) {
  const { code, postType, destinations } = error?.extensions || {}
  if (code === POST_TYPE_NOT_ACCEPTED && Array.isArray(destinations) && destinations.length > 0) {
    return t('postTypeNotAccepted', {
      count: destinations.length,
      destinations: formatList(destinations, language),
      postType: postTypeLabel(t, postType)
    })
  }
  return error?.message || t('There was an error, please try again.')
}
