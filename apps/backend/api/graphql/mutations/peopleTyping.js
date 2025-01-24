export default async function peopleTyping (parent, { postId, commentId }, context, info) {
  context.pubSub.publish(postId ? `peopleTyping:postId:${postId}` : `peopleTyping:postId:${commentId}`, { user: { id: context.currentUserId } })

  return { success: true }
}
