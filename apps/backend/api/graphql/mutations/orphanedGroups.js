/* global Admin, GroupMembership, User */
import { GraphQLError } from 'graphql'
import {
  findOrphanedGroups,
  isOrphanedGroup,
  searchActiveMembers,
  soleAdministratorGroups
} from '../../models/group/administrators'

export const ADMIN_REQUIRED_ERROR = 'Unauthorized: Admin access required'

async function assertSuperAdmin (userId) {
  if (!(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError(ADMIN_REQUIRED_ERROR)
  }
}

/**
 * Staff list of active top-level groups that still have members but no active
 * Administrator (see group/administrators.js).
 */
export async function orphanedGroups (userId, { first, offset } = {}) {
  await assertSuperAdmin(userId)
  return findOrphanedGroups({ first, offset })
}

/**
 * Staff search of a group's active members, for choosing its next Administrator.
 */
export async function orphanedGroupMembers (userId, { groupId, search } = {}) {
  await assertSuperAdmin(userId)
  if (!groupId) throw new GraphQLError('No groupId passed into function')
  return searchActiveMembers(groupId, { search })
}

/**
 * Staff tool: give an active member the Administrator role in a group that has
 * members but no active Administrator.
 */
export async function assignOrphanedGroupAdministrator (userId, { groupId, personId } = {}) {
  await assertSuperAdmin(userId)
  if (!groupId || !personId) throw new GraphQLError('A group and a member are required')

  if (!(await isOrphanedGroup(groupId))) {
    throw new GraphQLError('This group already has an Administrator')
  }

  const membership = await GroupMembership.forPair(personId, groupId).fetch()
  const person = membership && await User.find(personId)
  if (!person || !person.get('active')) {
    throw new GraphQLError('Only an active member of this group can become its Administrator')
  }

  await GroupMembership.assignAdministratorRole(personId, groupId)
  return { success: true }
}

/**
 * Groups where this person is the only active Administrator, so they can hand
 * the role on before leaving, deactivating or deleting their account.
 */
export async function mySoleAdministratorGroups (userId) {
  if (!userId) return []
  const rows = await soleAdministratorGroups(userId)
  return rows.map(row => ({ id: row.id, name: row.name, slug: row.slug, avatarUrl: row.avatar_url }))
}
