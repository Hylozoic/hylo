import { GraphQLError } from 'graphql'

/**
 * Who can edit a post's content:
 * - its creator
 * - for track actions: anyone with Administration in one of the action's groups
 *   (track stewards edit actions that another steward created)
 */

export function isPostCreator (userId, post) {
  return !!userId && !!post && String(post.get('user_id')) === String(userId)
}

/** Track actions are managed by the track's stewards, who may not have created every action. */
export async function canEditAsTrackSteward (userId, post) {
  if (!userId || post.get('type') !== Post.Type.ACTION) return false
  await post.load('groups')
  const groups = post.relations.groups?.models || []
  for (const group of groups) {
    // Spaces use their parent group's roles
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, group.id)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) return true
  }
  return false
}

export async function canEditPost (userId, post) {
  if (!userId || !post) return false
  if (isPostCreator(userId, post)) return true
  return canEditAsTrackSteward(userId, post)
}

export async function assertCanEditPost (userId, post) {
  if (!post) throw new GraphQLError('Post not found')
  if (await canEditPost(userId, post)) return
  throw new GraphQLError("You don't have permission to modify this post")
}
