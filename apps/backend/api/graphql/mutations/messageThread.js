import { GraphQLError } from 'graphql'

/**
 * Remove the current user from a direct message thread.
 */
export async function leaveMessageThread (userId, messageThreadId) {
  const post = await Post.find(messageThreadId)
  if (!post || !post.isThread()) {
    throw new GraphQLError('Message thread not found')
  }

  const postUser = await PostUser.find(messageThreadId, userId)
  if (!postUser || !postUser.get('following') || !postUser.get('active')) {
    throw new GraphQLError('You are not a participant in this thread')
  }

  await post.updateFollowers([userId], { following: false, active: false })
  return { success: true }
}
