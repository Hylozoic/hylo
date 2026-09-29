/* global Post */
import { GraphQLError } from 'graphql'
import { NUDGE_ANSWERS, isOpenRequestType, recordNudgeAnswer } from '../../models/post/openRequestNudge'

/**
 * The author's one-tap answer to the open-request nudge (D58): 'still_needed' keeps the
 * post open, 'met' is recorded after the web app has fulfilled the post through
 * fulfillPost. Only the post's author can answer.
 */
export async function answerOpenRequestNudge (userId, { postId, answer }) {
  if (!userId) throw new GraphQLError('You need to be logged in to do that')
  if (!Object.values(NUDGE_ANSWERS).includes(answer)) throw new GraphQLError('Unknown answer')

  const post = postId && await Post.find(postId)
  if (!post || !post.get('active') || String(post.get('user_id')) !== String(userId) || !isOpenRequestType(post)) {
    throw new GraphQLError('Post not found')
  }

  await recordNudgeAnswer(post, answer)
  return { success: true }
}
