/**
 * Who is present in each group's socket room right now, fed by the server's
 * roster events: roomPresence (full roster on subscribe), memberPresent
 * (someone arrived), memberAway (their last socket left). Presence means live
 * sockets, not lastActiveAt heuristics.
 *
 * Clients only join the parent group room while that group is open. Space
 * activity (posts, typing) is fanned out to the parent room, so people present
 * in the parent are treated as present in its spaces too.
 */

export const SET_ROOM_PRESENCE = 'SET_ROOM_PRESENCE'
export const ADD_MEMBER_PRESENT = 'ADD_MEMBER_PRESENT'
export const REMOVE_MEMBER_PRESENT = 'REMOVE_MEMBER_PRESENT'

const EMPTY = {}

export default function reducer (state = {}, action) {
  const { type, payload } = action
  switch (type) {
    case SET_ROOM_PRESENCE: {
      const { groupId, members } = payload
      return {
        ...state,
        [String(groupId)]: Object.fromEntries((members || []).map(m => [String(m.id), m]))
      }
    }
    case ADD_MEMBER_PRESENT: {
      const { groupId, member } = payload
      if (!member?.id) return state
      return {
        ...state,
        [String(groupId)]: { ...(state[String(groupId)] || {}), [String(member.id)]: member }
      }
    }
    case REMOVE_MEMBER_PRESENT: {
      const { groupId, userId } = payload
      const room = state[String(groupId)]
      if (!room || !room[String(userId)]) return state
      const next = { ...room }
      delete next[String(userId)]
      return { ...state, [String(groupId)]: next }
    }
    default:
      return state
  }
}

export function setRoomPresence (groupId, members) {
  return { type: SET_ROOM_PRESENCE, payload: { groupId, members } }
}

export function addMemberPresent (groupId, member) {
  return { type: ADD_MEMBER_PRESENT, payload: { groupId, member } }
}

export function removeMemberPresent (groupId, userId) {
  return { type: REMOVE_MEMBER_PRESENT, payload: { groupId, userId } }
}

/**
 * Live roster for a group. For a space, include the parent group's roster —
 * anyone subscribed to the parent sees that space's posts in real time.
 */
export function getRoomPresence (state, groupId, parentGroupId) {
  const own = (groupId && state.RoomPresence?.[String(groupId)]) || EMPTY
  if (!parentGroupId || String(parentGroupId) === String(groupId)) return own
  const parent = state.RoomPresence?.[String(parentGroupId)] || EMPTY
  if (own === EMPTY || !Object.keys(own).length) return parent
  if (parent === EMPTY || !Object.keys(parent).length) return own
  return { ...parent, ...own }
}
