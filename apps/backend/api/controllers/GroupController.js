import { joinRoom, leaveRoom, pushToSockets, groupRoom } from '../services/Websockets'

module.exports = {
  subscribe: function (req, res) {
    joinRoom(req, res, 'group', res.locals.group.id)
  },

  unsubscribe: function (req, res) {
    leaveRoom(req, res, 'group', res.locals.group.id)
  },

  // Broadcasts a typing indicator to everyone in the group's socket room (e.g. the chat view)
  typing: function (req, res) {
    const { group } = res.locals
    const { body: { isTyping }, socket } = req

    return User.find(req.session.userId)
      .then(user => pushToSockets(
        groupRoom(group.id),
        'userTyping',
        { userId: user.id, userName: user.get('name'), isTyping },
        socket
      ))
      .then(() => res.ok({}))
  }
}
