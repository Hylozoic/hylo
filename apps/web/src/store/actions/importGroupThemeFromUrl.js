export const IMPORT_GROUP_THEME_FROM_URL = 'IMPORT_GROUP_THEME_FROM_URL'

/**
 * Asks the server to suggest a group theme from a website's look. Nothing is
 * saved: the response (payload.data.importGroupThemeFromUrl) holds suggested
 * color roles, radius, border width and fonts, plus the AI model's token usage
 * and estimated cost.
 */
export default function importGroupThemeFromUrl (groupId, url) {
  return {
    type: IMPORT_GROUP_THEME_FROM_URL,
    graphql: {
      query: `mutation ImportGroupThemeFromUrl ($groupId: ID, $url: String) {
        importGroupThemeFromUrl(groupId: $groupId, url: $url)
      }`,
      variables: {
        groupId,
        url
      }
    },
    meta: {
      groupId
    }
  }
}
