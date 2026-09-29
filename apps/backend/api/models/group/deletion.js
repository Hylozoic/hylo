/* global bookshelf, Email, Group, Queue, User, Frontend */
import { GraphQLError } from 'graphql'

/*
  When a group is deleted, the memberships it had (its own and its spaces'),
  its role assignments and its members' accepted agreements are recorded in
  group_deletions, so Hylo staff can restore the group and exactly those
  memberships for RESTORE_WINDOW_DAYS. People whose accounts have been closed
  since are left out of a restore.
*/

export const RESTORE_WINDOW_DAYS = 30

// Deleting a group with more members than this asks the steward to type its name
export const DELETE_CONFIRM_NAME_MEMBER_THRESHOLD = 10

export const CONFIRM_NAME_ERROR = "Type the group's name to delete it"

function withTransaction (query, transacting) {
  return transacting ? query.transacting(transacting) : query
}

/**
 * Whether deleting this group needs its name typed, and if so whether
 * confirmName matches it (ignoring case and surrounding spaces).
 */
export function assertDeleteConfirmed (group, confirmName) {
  if ((group.get('num_members') || 0) <= DELETE_CONFIRM_NAME_MEMBER_THRESHOLD) return
  const expected = (group.get('name') || '').trim().toLowerCase()
  if ((confirmName || '').trim().toLowerCase() !== expected) {
    throw new GraphQLError(CONFIRM_NAME_ERROR)
  }
}

/**
 * Record what deleting this group will take away, before it is taken away.
 * Returns the new group_deletions row id.
 */
export async function recordGroupDeletion (group, deletedById, { transacting } = {}) {
  const groupId = group.id
  const spaceIds = await withTransaction(
    bookshelf.knex('groups').where({ parent_id: groupId, type: 'space' }).pluck('id'), transacting)

  const memberships = await withTransaction(
    bookshelf.knex('group_memberships')
      .whereIn('group_id', [groupId, ...spaceIds])
      .where('active', true)
      .select('id', 'group_id', 'user_id', 'settings', 'nav_order'), transacting)

  const roleAssignments = await withTransaction(
    bookshelf.knex('group_memberships_group_roles')
      .where('group_id', groupId)
      .select('user_id', 'group_role_id', 'active'), transacting)

  const memberIds = memberships.filter(m => String(m.group_id) === String(groupId)).map(m => m.user_id)
  const agreementIds = memberIds.length === 0
    ? []
    : await withTransaction(
      bookshelf.knex('users_groups_agreements')
        .where({ group_id: groupId, accepted: true })
        .whereIn('user_id', memberIds)
        .pluck('id'), transacting)

  const now = new Date()
  const restorableUntil = new Date(now.getTime() + RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [row] = await withTransaction(
    bookshelf.knex('group_deletions').insert({
      group_id: groupId,
      deleted_by_id: deletedById || null,
      memberships: JSON.stringify(memberships.map(m => ({ id: m.id, group_id: m.group_id, user_id: m.user_id, settings: m.settings || {}, nav_order: m.nav_order ?? null }))),
      role_assignments: JSON.stringify(roleAssignments),
      accepted_agreement_ids: JSON.stringify(agreementIds),
      restorable_until: restorableUntil,
      created_at: now
    }).returning('id'), transacting)
  return row && typeof row === 'object' ? row.id : row
}

/**
 * Deletions staff can still restore: not restored yet, still inside the window,
 * newest first, as plain objects.
 */
export async function restorableDeletions () {
  const rows = await bookshelf.knex('group_deletions as d')
    .join('groups as g', 'g.id', 'd.group_id')
    .leftJoin('users as u', 'u.id', 'd.deleted_by_id')
    .whereNull('d.restored_at')
    .where('d.restorable_until', '>', new Date())
    .where('g.active', false)
    .orderBy('d.created_at', 'desc')
    .select('d.id', 'd.group_id', 'd.created_at', 'd.restorable_until', 'd.memberships', 'g.name', 'g.slug', 'g.avatar_url', 'u.name as deleted_by_name')
  return rows.map(row => {
    const memberships = typeof row.memberships === 'string' ? JSON.parse(row.memberships) : (row.memberships || [])
    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      slug: row.slug,
      avatarUrl: row.avatar_url,
      deletedAt: row.created_at,
      restorableUntil: row.restorable_until,
      deletedByName: row.deleted_by_name,
      memberCount: memberships.filter(m => String(m.group_id) === String(row.group_id)).length
    }
  })
}

function parseJson (value, fallback) {
  if (value == null) return fallback
  return typeof value === 'string' ? JSON.parse(value) : value
}

/**
 * Bring a deleted group back with exactly the memberships (with their settings
 * and menu position), role assignments and accepted agreements recorded when it
 * was deleted, for people whose accounts are still active. Refused once
 * restored or after the window. A group with a Murmurations profile is
 * published there again.
 */
export async function restoreGroupDeletion (deletionId, restoredById) {
  const result = await bookshelf.transaction(async transacting => {
    const deletion = await bookshelf.knex('group_deletions').where({ id: deletionId }).forUpdate().first().transacting(transacting)
    if (!deletion) throw new GraphQLError('Deleted group not found')
    if (deletion.restored_at) throw new GraphQLError('This group has already been restored')
    if (new Date(deletion.restorable_until) <= new Date()) {
      throw new GraphQLError(`Deleted groups can only be restored for ${RESTORE_WINDOW_DAYS} days`)
    }

    const groupId = deletion.group_id
    const recordedMemberships = parseJson(deletion.memberships, [])
    const recordedUserIds = [...new Set(recordedMemberships.map(m => String(m.user_id)))]
    const activeUserIds = new Set(recordedUserIds.length === 0
      ? []
      : (await bookshelf.knex('users').whereIn('id', recordedUserIds).where('active', true).pluck('id').transacting(transacting)).map(String))
    const memberships = recordedMemberships.filter(m => activeUserIds.has(String(m.user_id)))
    const roleAssignments = parseJson(deletion.role_assignments, []).filter(a => activeUserIds.has(String(a.user_id)))
    const agreementIds = parseJson(deletion.accepted_agreement_ids, [])

    await bookshelf.knex('groups').where({ id: groupId }).update({ active: true, updated_at: new Date() }).transacting(transacting)

    for (const membership of memberships) {
      await bookshelf.knex('group_memberships')
        .where({ id: membership.id, user_id: membership.user_id, group_id: membership.group_id })
        .update({ active: true, settings: JSON.stringify(membership.settings || {}), nav_order: membership.nav_order ?? null, updated_at: new Date() })
        .transacting(transacting)
    }

    for (const assignment of roleAssignments) {
      const exists = await bookshelf.knex('group_memberships_group_roles')
        .where({ user_id: assignment.user_id, group_id: groupId, group_role_id: assignment.group_role_id })
        .first('id')
        .transacting(transacting)
      if (!exists) {
        await bookshelf.knex('group_memberships_group_roles')
          .insert({ user_id: assignment.user_id, group_id: groupId, group_role_id: assignment.group_role_id, active: assignment.active !== false })
          .transacting(transacting)
      }
    }

    if (agreementIds.length > 0) {
      await bookshelf.knex('users_groups_agreements').whereIn('id', agreementIds).update({ accepted: true }).transacting(transacting)
    }

    const groupIds = [...new Set([groupId, ...memberships.map(m => m.group_id)].map(String))]
    await bookshelf.knex.raw(`
      UPDATE groups SET num_members = (
        SELECT COUNT(*) FROM group_memberships gm
        JOIN users u ON u.id = gm.user_id AND u.active = true
        WHERE gm.group_id = groups.id AND gm.active = true
      )
      WHERE id = ANY(?)
    `, [groupIds.map(Number)]).transacting(transacting)

    await bookshelf.knex('group_deletions').where({ id: deletionId })
      .update({ restored_at: new Date(), restored_by_id: restoredById || null })
      .transacting(transacting)

    return { success: true, groupId }
  })

  const group = await Group.find(result.groupId)
  if (group && group.hasMurmurationsProfile()) {
    await Queue.classMethod('Group', 'publishToMurmurations', { groupId: group.id })
  }
  return result
}

/**
 * Background job: tell each person who was a member of a deleted group that it
 * was closed, in their own language.
 */
export async function sendGroupClosedEmails ({ groupId, userIds = [], closedById }) {
  const group = await Group.find(groupId)
  if (!group || userIds.length === 0) return 0
  const closedBy = closedById ? await User.find(closedById, {}, false) : null
  const users = await User.query(q => {
    q.whereIn('id', userIds)
    q.where('active', true)
  }).fetchAll()

  let sent = 0
  for (const user of users.models) {
    const name = user.get('name') || ''
    const result = await Email.sendGroupClosed({
      email: user.get('email'),
      locale: user.getLocale(),
      data: {
        first_name: name.split(' ')[0] || name,
        group_name: group.get('name'),
        closed_by_name: closedBy ? closedBy.get('name') : null,
        explore_url: Frontend.Route.prefix + '/public/groups'
      }
    })
    if (result) sent += 1
  }
  return sent
}

/**
 * Who should hear that a group is being deleted: its active members with
 * active accounts, other than the person deleting it. Read this before the
 * members are removed.
 */
export async function groupClosedRecipientIds (group, closedById, { transacting } = {}) {
  return withTransaction(
    bookshelf.knex('group_memberships as gm')
      .join('users as u', 'u.id', 'gm.user_id')
      .where({ 'gm.group_id': group.id, 'gm.active': true, 'u.active': true })
      .whereNot('gm.user_id', closedById || 0)
      .pluck('gm.user_id'), transacting)
}

/**
 * Queue the notice to those members once the deletion has been saved.
 */
export async function queueGroupClosedEmails ({ groupId, userIds, closedById }) {
  if (!userIds || userIds.length === 0) return
  await Queue.classMethod('Group', 'sendGroupClosedEmails', { groupId, userIds, closedById })
}
