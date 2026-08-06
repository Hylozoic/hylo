/**
 * Who is present in each group's socket room right now, fed by the server's
 * roster events: roomPresence (full roster on subscribe), memberPresent
 * (someone arrived), memberAway (their last socket left). Presence means live
 * sockets, not lastActiveAt heuristics.
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

export function getRoomPresence (state, groupId) {
  return (groupId && state.RoomPresence?.[String(groupId)]) || EMPTY
}
