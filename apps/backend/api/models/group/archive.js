/* global bookshelf, Group */
import { GraphQLError } from 'graphql'

/*
  A top-level group can be archived: it stays readable for its members, but
  nothing new can be added to it or to its spaces (posts and chat, comments,
  joins, join requests, new members and new spaces). Its Administrators can
  open it again. Spaces keep their own separate archived status.
*/

export const ARCHIVED_GROUP_ERROR = 'This group is archived and read-only'

function groupIdOf (groupOrId) {
  if (groupOrId && typeof groupOrId === 'object') return groupOrId.id
  return groupOrId
}

/**
 * Ids (as strings) of the given groups that are archived top-level groups or
 * spaces inside one.
 */
export async function archivedGroupIds (groupsOrIds, { transacting } = {}) {
  const ids = [...new Set([].concat(groupsOrIds || []).map(groupIdOf).filter(id => id != null && id !== ''))]
    .filter(id => /^\d+$/.test(String(id)))
  if (ids.length === 0) return []
  let query = bookshelf.knex('groups as g')
    .leftJoin('groups as parent', 'parent.id', 'g.parent_id')
    .whereIn('g.id', ids)
    .where(q => {
      q.where(top => top.whereNull('g.parent_id').whereRaw("g.type IS DISTINCT FROM 'space'").where('g.status', Group.Status.ARCHIVED))
        .orWhere(inside => inside.whereNotNull('g.parent_id').where('parent.status', Group.Status.ARCHIVED).whereNull('parent.parent_id'))
    })
    .pluck('g.id')
  if (transacting) query = query.transacting(transacting)
  return (await query).map(String)
}

/**
 * Whether this is an archived top-level group, or a space inside one.
 */
export async function isArchived (groupOrId, opts = {}) {
  return (await archivedGroupIds([groupOrId], opts)).length > 0
}

/**
 * Throw ARCHIVED_GROUP_ERROR if any of these groups is archived (see isArchived).
 */
export async function assertWritable (groupsOrIds, opts = {}) {
  if ((await archivedGroupIds(groupsOrIds, opts)).length > 0) {
    throw new GraphQLError(ARCHIVED_GROUP_ERROR)
  }
}

/**
 * Throw ARCHIVED_GROUP_ERROR if a post would be added to, or already lives in,
 * an archived group: pass the groups it is being posted to, its id, or both.
 */
export async function assertPostWritable ({ groupIds = [], postId } = {}, opts = {}) {
  let ids = [].concat(groupIds || [])
  if (postId && /^\d+$/.test(String(postId))) {
    let query = bookshelf.knex('groups_posts').where('post_id', postId).pluck('group_id')
    if (opts.transacting) query = query.transacting(opts.transacting)
    ids = ids.concat(await query)
  }
  await assertWritable(ids, opts)
}
