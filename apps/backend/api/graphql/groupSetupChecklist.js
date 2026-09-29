/* global bookshelf, GroupMembership, Responsibility */

// Progress on a new group's setup checklist (invite people, write a welcome
// post, add a first event). The web menu shows it to the group's founder
// until a second member joins or someone else posts. Only the group's
// Administrators can read it.

// System rows that aren't anyone posting
const NOTICE_POST_TYPES = ['chat_activity']
// A chat message isn't a welcome post
const NOT_A_WELCOME_POST = ['chat', 'chat_activity']

function exists (query) {
  return query.select(bookshelf.knex.raw('1')).first().then(row => Boolean(row))
}

function activeGroupPosts (groupId) {
  return bookshelf.knex('groups_posts')
    .join('posts', 'posts.id', 'groups_posts.post_id')
    .where('groups_posts.group_id', groupId)
    .where('posts.active', true)
}

export async function groupSetupChecklist (group, userId) {
  const groupId = group.id
  const creatorId = group.get('created_by_id')
  if (!creatorId) {
    return {
      isCreator: false,
      hasOtherMembers: false,
      hasPostByOthers: false,
      hasCreatorPost: false,
      hasEvent: false,
      hasInvitation: false
    }
  }

  const [hasOtherMembers, hasPostByOthers, hasCreatorPost, hasEvent, hasInvitation] = await Promise.all([
    exists(
      bookshelf.knex('group_memberships')
        .where({ group_id: groupId, active: true })
        .whereNot('user_id', creatorId)
    ),
    exists(
      activeGroupPosts(groupId)
        .whereNot('posts.user_id', creatorId)
        .whereNotIn('posts.type', NOTICE_POST_TYPES)
    ),
    exists(
      activeGroupPosts(groupId)
        .where('posts.user_id', creatorId)
        .whereNotIn('posts.type', NOT_A_WELCOME_POST)
    ),
    exists(
      activeGroupPosts(groupId)
        .where('posts.type', 'event')
    ),
    exists(
      bookshelf.knex('group_invites').where({ group_id: groupId })
    )
  ])

  return {
    isCreator: String(creatorId) === String(userId),
    hasOtherMembers,
    hasPostByOthers,
    hasCreatorPost,
    hasEvent,
    hasInvitation
  }
}

/** The checklist for Administrators of a group (not a space); null for everyone else. */
export async function groupSetupChecklistFor (group, userId) {
  if (!userId || group.get('type') === 'space') return null
  const canAdminister = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION)
  if (!canAdminister) return null
  return groupSetupChecklist(group, userId)
}
