import { GraphQLError } from 'graphql'

async function findParticipantPostUser (userId, messageThreadId) {
  const post = await Post.find(messageThreadId)
  if (!post || !post.isThread()) {
    throw new GraphQLError('Message thread not found')
  }

  const postUser = await PostUser.find(messageThreadId, userId)
  if (!postUser || !postUser.get('following') || !postUser.get('active')) {
    throw new GraphQLError('You are not a participant in this thread')
  }

  return { post, postUser }
}

/**
 * Mute a direct message thread for the current user.
 */
export async function muteMessageThread (userId, messageThreadId) {
  const { postUser } = await findParticipantPostUser(userId, messageThreadId)

  if (postUser.get('muted_at')) {
    return { success: true }
  }

  await postUser.updateAndSave({ muted_at: new Date() })
  return { success: true }
}

/**
 * Unmute a direct message thread for the current user.
 */
export async function unmuteMessageThread (userId, messageThreadId) {
  const { postUser } = await findParticipantPostUser(userId, messageThreadId)

  if (!postUser.get('muted_at')) {
    return { success: true }
  }

  await postUser.updateAndSave({ muted_at: null })
  return { success: true }
}
