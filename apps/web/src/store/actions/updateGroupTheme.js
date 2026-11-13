export const UPDATE_GROUP_THEME = 'UPDATE_GROUP_THEME'

/**
 * Replaces a group's whole theme (group.settings.theme); null clears it.
 *
 * Themes have their own mutation because updateGroupSettings snake-cases nested
 * keys (card-foreground) and deep-merges settings, so overrides could never be
 * removed. The ormReducer copies the saved theme onto the group's settings.
 */
export default function updateGroupTheme (groupId, theme) {
  return {
    type: UPDATE_GROUP_THEME,
    graphql: {
      query: `mutation UpdateGroupTheme ($groupId: ID, $theme: JSON) {
        updateGroupTheme(groupId: $groupId, theme: $theme) {
          id
          settings {
            theme
          }
        }
      }`,
      variables: {
        groupId,
        theme
      }
    },
    meta: {
      groupId,
      theme
    }
  }
}
