/**
 * First letter of each of the first two words in a group name.
 * A single-word name uses just its first letter.
 * @param {string} name
 * @returns {string}
 */
export function groupInitials (name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const letters = words.slice(0, 2).map(word => word.charAt(0))
  return letters.join('').toUpperCase()
}

/**
 * True when a group has no uploaded avatar, including the stock default image.
 * @param {string} avatarUrl
 * @returns {boolean}
 */
export function isDefaultGroupAvatar (avatarUrl) {
  if (!avatarUrl) return true
  const path = avatarUrl.split('?')[0]
  return path.endsWith('/default-group-avatar.svg') || path.endsWith('/default_group_avatar.png')
}
