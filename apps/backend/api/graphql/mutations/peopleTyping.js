export default async function peopleTyping (parent, { messageThreadId, postId, commentId }, context, info) {
  context.pubSub.publish(messageThreadId
    ? `peopleTyping:messageThreadId:${messageThreadId}`
    : postId
      ? `peopleTyping:postId:${postId}`
      : `peopleTyping:commentId:${commentId}`
  , { user: { id: context.currentUserId } })

  // Bridge to sockets, if it is inefficient we can call this peopleTyping mutation in Web
  // even before Web is setup to handle the subscription, and the userIsTyping socket event
  // will still push through the socket (see PostController#typing).
  const currentUser = await User.find(context.currentUserId)
  const post = await Post.find(messageThreadId || postId)
  post.pushTypingToSockets(currentUser.id, currentUser.get('name'), true, context.socket)

  return { success: true }
}
