/**
 * True when this space is a chat room (it only accepts chat posts).
 * @param {object} space
 * @returns {boolean}
 */
export default function isChatOnlySpace (space) {
  if (!space || space.type !== 'space') return false
  const types = space.acceptedPostTypes
  return Array.isArray(types) && types.length === 1 && types[0] === 'chat'
}
