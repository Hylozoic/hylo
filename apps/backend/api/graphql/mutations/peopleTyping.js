export default async function peopleTyping (parent, { messageThreadId, postId, commentId }, context, info) {
  context.pubSub.publish(messageThreadId
    ? `peopleTyping:messageThreadId:${messageThreadId}`
    : postId
      ? `peopleTyping:postId:${postId}`
      : `peopleTyping:commentId:${commentId}`
  , { user: { id: context.currentUserId } })

  return { success: true }
}
