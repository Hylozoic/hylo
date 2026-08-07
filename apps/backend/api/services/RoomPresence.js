/**
 * In-memory presence roster for socket rooms.
 *
 * Presence means "this user has at least one live socket subscribed to this
 * room" — reference-counted per user, since one person can hold several tabs
 * and devices at once. Nothing is persisted: a process restart empties the
 * roster, and reconnecting sockets rebuild it through their re-subscribes.
 *
 * NOTE: this state is process-local. Under a multi-process socket adapter the
 * roster would need to move into the shared adapter (e.g. redis) — fine for
 * dev and the current single-process deployment.
 */

// room -> Map<userId, Set<socketId>>
const rooms = new Map()
// socketId -> Map<room, userId> (reverse index so disconnects clean up fully)
const socketIndex = new Map()

/** Registers a socket for a user in a room. True when the user was absent before. */
export function join (room, userId, socketId) {
  if (!room || !userId || !socketId) return false
  const uid = String(userId)

  let members = rooms.get(room)
  if (!members) {
    members = new Map()
    rooms.set(room, members)
  }
  const wasAbsent = !members.has(uid)
  let sockets = members.get(uid)
  if (!sockets) {
    sockets = new Set()
    members.set(uid, sockets)
  }
  sockets.add(socketId)

  let memberships = socketIndex.get(socketId)
  if (!memberships) {
    memberships = new Map()
    socketIndex.set(socketId, memberships)
  }
  memberships.set(room, uid)

  return wasAbsent
}

/** Removes one socket of a user from a room. True when the user is now absent. */
export function leave (room, userId, socketId) {
  if (!room || !userId || !socketId) return false
  const uid = String(userId)

  socketIndex.get(socketId)?.delete(room)
  if (socketIndex.get(socketId)?.size === 0) socketIndex.delete(socketId)

  const members = rooms.get(room)
  const sockets = members?.get(uid)
  if (!sockets) return false
  sockets.delete(socketId)
  if (sockets.size > 0) return false
  members.delete(uid)
  if (members.size === 0) rooms.delete(room)
  return true
}

/** Removes a dead socket everywhere. Returns [{ room, userId }] for users now absent. */
export function dropSocket (socketId) {
  const memberships = socketIndex.get(socketId)
  if (!memberships) return []
  const departures = []
  for (const [room, uid] of memberships) {
    // leave() also prunes this socketIndex entry
    if (leave(room, uid, socketId)) departures.push({ room, userId: uid })
  }
  return departures
}

/** User ids currently present in a room. */
export function roster (room) {
  return [...(rooms.get(room)?.keys() || [])]
}
