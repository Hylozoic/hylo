import { GraphQLError } from 'graphql'

const FULFILLABLE_TYPES = ['offer', 'request', 'resource', 'project', 'proposal']

/** Returns whether this post type supports fulfill/unfulfill. */
export function postCanBeFulfilled (post) {
  const type = post.get('type')
  if (!FULFILLABLE_TYPES.includes(type)) return false
  if (type === 'proposal') {
    const status = post.get('proposal_status')
    return status === 'completed' || status === 'casual'
  }
  return true
}

/** True when user has Administration or Manage Content in any group the post belongs to. */
export async function canFulfillPostAsModerator (userId, post) {
  if (!postCanBeFulfilled(post)) return false
  await post.load('groups')
  const groups = post.relations.groups?.models || []
  if (groups.length === 0) return false

  const { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } = Responsibility.constants
  for (const group of groups) {
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, group.id)
    const canModerate = responsibilities.includes(RESP_ADMINISTRATION) ||
      responsibilities.includes(RESP_MANAGE_CONTENT)
    if (canModerate) return true
  }
  return false
}

/** Throws when the user cannot fulfill or unfulfill this post. */
export async function assertCanFulfillPost (userId, post) {
  if (!post) throw new GraphQLError('Post does not exist')
  if (post.get('user_id') === userId) return
  if (await canFulfillPostAsModerator(userId, post)) return
  throw new GraphQLError("You don't have permission to modify this post")
}

/** Notifies the post author when a moderator fulfills or unfulfills their post. */
export async function notifyAuthorOfModeratorFulfillment ({ post, actorId, fulfilled }) {
  const authorId = post.get('user_id')
  if (String(authorId) === String(actorId)) return

  await post.load('groups')
  const groups = post.relations.groups?.models || []
  if (groups.length === 0) return

  const reason = fulfilled ? Activity.Reason.PostFulfilled : Activity.Reason.PostUnfulfilled

  await Activity.saveForReasons([{
    reader_id: authorId,
    actor_id: actorId,
    post_id: post.id,
    group_id: groups[0].id,
    reasons: [reason],
    created_at: new Date()
  }])
}
