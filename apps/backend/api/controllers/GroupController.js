import { joinRoom, leaveRoom, pushToSockets, groupRoom } from '../services/Websockets'
import * as RoomPresence from '../services/RoomPresence'

module.exports = {
  subscribe: function (req, res) {
    const group = res.locals.group
    const userId = req.session.userId
    return joinRoom(req, res, 'group', group.id, {
      callback: async (err) => {
        if (err) return res.serverError(err)
        try {
          const room = groupRoom(group.id)
          const socketId = sails.sockets.getId(req)
          const newlyPresent = RoomPresence.join(room, userId, socketId)

          // The newcomer gets the full roster; the room hears about a genuinely
          // new arrival (not extra tabs of someone already here)
          const rosterIds = RoomPresence.roster(room)
          const users = await User.where('id', 'in', rosterIds).fetchAll()
          const members = users.map(u => ({ id: u.id, name: u.get('name'), avatarUrl: u.get('avatar_url') }))
          sails.sockets.broadcast(socketId, 'roomPresence', { groupId: group.id, members })
          if (newlyPresent) {
            const me = members.find(m => String(m.id) === String(userId))
            if (me) pushToSockets(room, 'memberPresent', { groupId: group.id, member: me }, req.socket)
          }
        } catch (e) {
          sails.log.error('RoomPresence subscribe error:', e)
        }
        return res.ok({})
      }
    })
  },

  unsubscribe: function (req, res) {
    const group = res.locals.group
    const userId = req.session.userId
    try {
      const room = groupRoom(group.id)
      const nowAbsent = RoomPresence.leave(room, userId, sails.sockets.getId(req))
      if (nowAbsent) pushToSockets(room, 'memberAway', { groupId: group.id, userId: String(userId) }, req.socket)
    } catch (e) {
      sails.log.error('RoomPresence unsubscribe error:', e)
    }
    leaveRoom(req, res, 'group', group.id)
  },

  // Broadcasts a typing indicator to everyone in the group's socket room (e.g. the chat view)
  typing: function (req, res) {
    const { group } = res.locals
    const { body: { isTyping }, socket } = req

    return User.find(req.session.userId)
      .then(user => pushToSockets(
        groupRoom(group.id),
        'userTyping',
        { userId: user.id, userName: user.get('name'), isTyping, groupId: String(group.id) },
        socket
      ))
      .then(() => res.ok({}))
  }
}
