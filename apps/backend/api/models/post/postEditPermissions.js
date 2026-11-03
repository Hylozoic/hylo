import { GraphQLError } from 'graphql'
import { uniq } from 'lodash'

/**
 * Who can edit a post (#1727):
 * - its creator
 * - when the creator turned on `group_admins_can_edit` and the post lives in exactly one group
 *   (that group and/or any of its spaces): members with Manage Content or Administration in that group
 * - track actions: anyone with Administration in one of the action's groups (track editors)
 */

/** Post types whose co-editing toggle is offered. Chats are quick messages; actions and submissions have their own flows. */
export const GROUP_ADMIN_EDITABLE_TYPES = ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']

/** The group a group or space belongs to: a space's parent group, otherwise the group itself. */
export function rootGroupId (group) {
  if (group.get('type') === 'space') {
    return group.get('parent_id') ? String(group.get('parent_id')) : String(group.id)
  }
  return String(group.id)
}

/** Returns the single group id these groups belong to, or null when they span more than one group (or none). */
export function singleRootGroupIdForGroups (groups) {
  const roots = uniq((groups || []).map(rootGroupId))
  return roots.length === 1 ? roots[0] : null
}

/** Loads the given group ids and returns the single group they belong to, or null. */
export async function singleRootGroupIdForGroupIds (groupIds) {
  if (!groupIds || groupIds.length === 0) return null
  const groups = await Group.query(q => q.whereIn('id', groupIds)).fetchAll()
  // An id we can't find counts as its own group, so it can never make a multi-group post look single-group
  if (groups.length !== uniq(groupIds.map(String)).length) return null
  return singleRootGroupIdForGroups(groups.models)
}

/** The single group a post belongs to (several spaces of the same group still count as one), or null. */
export async function singleRootGroupIdForPost (post) {
  await post.load('groups')
  return singleRootGroupIdForGroups(post.relations.groups?.models)
}

/** True when the user has Manage Content or Administration in the group (spaces use their parent group's roles). */
export async function canManageContentInGroup (userId, groupId) {
  if (!userId || !groupId) return false
  const { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } = Responsibility.constants
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  return responsibilities.includes(RESP_MANAGE_CONTENT) || responsibilities.includes(RESP_ADMINISTRATION)
}

export function isPostCreator (userId, post) {
  return !!userId && String(post.get('user_id')) === String(userId)
}

/** True when another group admin can edit this post because its creator allowed it. */
export async function canEditAsGroupAdmin (userId, post) {
  if (!userId || !post.get('group_admins_can_edit')) return false
  if (!GROUP_ADMIN_EDITABLE_TYPES.includes(post.get('type'))) return false
  const groupId = await singleRootGroupIdForPost(post)
  if (!groupId) return false
  return canManageContentInGroup(userId, groupId)
}

/** Track actions are managed by the track's stewards, who may not have created every action. */
async function canEditTrackAction (userId, post) {
  if (post.get('type') !== Post.Type.ACTION) return false
  await post.load('groups')
  const groups = post.relations.groups?.models || []
  const { RESP_ADMINISTRATION } = Responsibility.constants
  for (const group of groups) {
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, group.id)
    if (responsibilities.includes(RESP_ADMINISTRATION)) return true
  }
  return false
}

export async function canEditPost (userId, post) {
  if (!userId || !post) return false
  if (isPostCreator(userId, post)) return true
  if (await canEditAsGroupAdmin(userId, post)) return true
  return canEditTrackAction(userId, post)
}

export async function assertCanEditPost (userId, post) {
  if (!post) throw new GraphQLError('Post not found')
  if (await canEditPost(userId, post)) return
  throw new GraphQLError("You don't have permission to modify this post")
}

/**
 * Throws unless the user may turn on group admin editing for a post going to these groups:
 * the groups must all belong to one group, and the user must manage content there.
 */
export async function assertCanAllowGroupAdminEdits (userId, groupIds) {
  const groupId = await singleRootGroupIdForGroupIds(groupIds)
  if (!groupId) {
    throw new GraphQLError('Editing by group admins is only available for posts in a single group')
  }
  if (!(await canManageContentInGroup(userId, groupId))) {
    throw new GraphQLError('Only members who manage content in this group can allow group admins to edit')
  }
}
