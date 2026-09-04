export const NAV_STYLE_GROUP_DEFAULT = 'group-default'
export const NAV_STYLE_TWO_COLUMN = 'two-column'
export const NAV_STYLE_ONE_COLUMN = 'one-column'

/**
 * Resolves the effective group menu layout from the user's groupNavStyle preference
 * and the group's layout setting. User overrides win when set to one/two column.
 */
export function resolveGroupLayout (userNavStyle, groupLayout) {
  if (userNavStyle === NAV_STYLE_ONE_COLUMN || userNavStyle === NAV_STYLE_TWO_COLUMN) {
    return userNavStyle
  }
  return groupLayout === NAV_STYLE_ONE_COLUMN ? NAV_STYLE_ONE_COLUMN : NAV_STYLE_TWO_COLUMN
}

/**
 * Returns true when the resolved layout uses the one-column (card menu) style.
 */
export function isOneColumnLayout (userNavStyle, groupLayout) {
  return resolveGroupLayout(userNavStyle, groupLayout) === NAV_STYLE_ONE_COLUMN
}

/**
 * Returns true when the user has explicitly chosen the card menu for all contexts
 * (My / All / Public). Group-default does not enable card menu outside groups.
 */
export function isCardMenuPreference (userNavStyle) {
  return userNavStyle === NAV_STYLE_ONE_COLUMN
}
