/* global bookshelf, Responsibility */
import { GraphQLError } from 'graphql'
/*
  Who administers a top-level group.

  An active Administrator is a person with an active account and an active
  membership in the group who holds the system Administration responsibility
  through an active role of that group. Roles live on the top-level group, so
  spaces have no Administrators of their own.
*/

// Error for role and membership changes that would leave a group without one
export const LAST_ADMINISTRATOR_ERROR = 'A group must keep at least one Administrator'

function withTransaction (query, transacting) {
  return transacting ? query.transacting(transacting) : query
}

async function administrationId (transacting) {
  return Responsibility.systemId(Responsibility.constants.RESP_ADMINISTRATION, { transacting })
}

/**
 * SQL (and bindings) for the role assignments that make someone an active
 * Administrator of the group whose id is in groupIdSql.
 */
function activeAdministratorAssignmentsSql (groupIdSql, administrationResponsibilityId) {
  return {
    sql: `
      FROM group_memberships_group_roles mgr
      JOIN groups_roles gr ON gr.id = mgr.group_role_id AND gr.group_id = mgr.group_id AND gr.active = true
      JOIN group_roles_responsibilities grr ON grr.group_role_id = gr.id AND grr.responsibility_id = ?
      JOIN group_memberships gm ON gm.group_id = mgr.group_id AND gm.user_id = mgr.user_id AND gm.active = true
      JOIN users u ON u.id = mgr.user_id AND u.active = true
      WHERE mgr.group_id = ${groupIdSql} AND mgr.active IS NOT FALSE`,
    bindings: [administrationResponsibilityId]
  }
}

/**
 * How many active Administrators a group has, optionally leaving out:
 * - excludeUserId: everything that person holds (they are leaving or being removed)
 * - excludeAssignment { userId, roleId }: one person's one role (the role is being taken away)
 * - excludeRoleId: a role (it is being deactivated)
 * - excludeRoleResponsibilityId: one role-responsibility link (it is being removed)
 */
export async function countActiveAdministrators (groupId, {
  excludeUserId,
  excludeAssignment,
  excludeRoleId,
  excludeRoleResponsibilityId,
  transacting
} = {}) {
  if (!groupId) return 0
  const adminId = await administrationId(transacting)
  if (!adminId) return 0

  const { sql, bindings } = activeAdministratorAssignmentsSql('?', adminId)
  const conditions = []
  const conditionBindings = []
  if (excludeUserId) {
    conditions.push('mgr.user_id <> ?')
    conditionBindings.push(excludeUserId)
  }
  if (excludeAssignment?.userId && excludeAssignment?.roleId) {
    conditions.push('NOT (mgr.user_id = ? AND mgr.group_role_id = ?)')
    conditionBindings.push(excludeAssignment.userId, excludeAssignment.roleId)
  }
  if (excludeRoleId) {
    conditions.push('gr.id <> ?')
    conditionBindings.push(excludeRoleId)
  }
  if (excludeRoleResponsibilityId) {
    conditions.push('grr.id <> ?')
    conditionBindings.push(excludeRoleResponsibilityId)
  }

  const query = bookshelf.knex.raw(
    `SELECT COUNT(DISTINCT mgr.user_id) AS count ${sql} ${conditions.map(c => `AND ${c}`).join(' ')}`,
    [...bindings, groupId, ...conditionBindings]
  )
  const { rows } = await withTransaction(query, transacting)
  return Number(rows[0].count)
}

/**
 * Throw LAST_ADMINISTRATOR_ERROR if the group has an active Administrator now
 * and would have none once the excluded people, roles or links are gone (see
 * countActiveAdministrators). A group that already has none is left to the
 * daily check for groups without an Administrator.
 */
export async function assertKeepsAdministrator (groupId, exclusions = {}) {
  if (!groupId) return
  const after = await countActiveAdministrators(groupId, exclusions)
  if (after > 0) return
  const before = await countActiveAdministrators(groupId, { transacting: exclusions.transacting })
  if (before > 0) throw new GraphQLError(LAST_ADMINISTRATOR_ERROR)
}

/**
 * Whether this person is an active Administrator of the group.
 */
export async function isActiveAdministrator (userId, groupId, { transacting } = {}) {
  if (!userId || !groupId) return false
  const all = await countActiveAdministrators(groupId, { transacting })
  if (all === 0) return false
  const others = await countActiveAdministrators(groupId, { excludeUserId: userId, transacting })
  return others < all
}

/**
 * Active top-level groups in which this person is the only active Administrator
 * and at least one other active member remains, as plain rows
 * { id, name, slug, avatar_url }, ordered by name.
 */
export async function soleAdministratorGroups (userId, { transacting } = {}) {
  if (!userId) return []
  const adminId = await administrationId(transacting)
  if (!adminId) return []

  const mine = activeAdministratorAssignmentsSql('g.id', adminId)
  const others = activeAdministratorAssignmentsSql('g.id', adminId)
  const query = bookshelf.knex.raw(`
    SELECT g.id, g.name, g.slug, g.avatar_url
    FROM groups g
    WHERE g.active = true AND g.parent_id IS NULL AND g.type IS DISTINCT FROM 'space'
      AND EXISTS (SELECT 1 ${mine.sql} AND mgr.user_id = ?)
      AND NOT EXISTS (SELECT 1 ${others.sql} AND mgr.user_id <> ?)
      AND EXISTS (
        SELECT 1 FROM group_memberships om
        JOIN users ou ON ou.id = om.user_id AND ou.active = true
        WHERE om.group_id = g.id AND om.active = true AND om.user_id <> ?
      )
    ORDER BY lower(g.name), g.id
  `, [...mine.bindings, userId, ...others.bindings, userId, userId])
  const { rows } = await withTransaction(query, transacting)
  return rows
}

/**
 * The SQL condition (and bindings) that selects active top-level groups that
 * still have active members but no active Administrator.
 */
async function orphanedGroupCondition (transacting) {
  const adminId = await administrationId(transacting)
  const admins = activeAdministratorAssignmentsSql('g.id', adminId)
  return {
    sql: `
      g.active = true AND g.parent_id IS NULL AND g.type IS DISTINCT FROM 'space'
      AND EXISTS (
        SELECT 1 FROM group_memberships m
        JOIN users mu ON mu.id = m.user_id AND mu.active = true
        WHERE m.group_id = g.id AND m.active = true
      )
      AND NOT EXISTS (SELECT 1 ${admins.sql})`,
    bindings: admins.bindings
  }
}

/**
 * How many active top-level groups have active members but no active Administrator.
 */
export async function countOrphanedGroups ({ transacting } = {}) {
  const { sql, bindings } = await orphanedGroupCondition(transacting)
  const query = bookshelf.knex.raw(`SELECT COUNT(*) AS count FROM groups g WHERE ${sql}`, bindings)
  const { rows } = await withTransaction(query, transacting)
  return Number(rows[0].count)
}

// Active members of these groups who hold an active Moderator or Host role,
// the people most likely to take over as Administrator
async function stewardCandidates (groupIds, transacting) {
  if (groupIds.length === 0) return []
  const query = bookshelf.knex.raw(`
    SELECT DISTINCT mgr.group_id, u.id, u.name, u.avatar_url, gr.name AS role_name
    FROM group_memberships_group_roles mgr
    JOIN groups_roles gr ON gr.id = mgr.group_role_id AND gr.group_id = mgr.group_id AND gr.active = true
    JOIN group_memberships gm ON gm.group_id = mgr.group_id AND gm.user_id = mgr.user_id AND gm.active = true
    JOIN users u ON u.id = mgr.user_id AND u.active = true
    WHERE mgr.group_id = ANY(?) AND mgr.active IS NOT FALSE
      AND gr.type = 'system' AND gr.name IN ('Moderator', 'Host')
    ORDER BY mgr.group_id, gr.name, u.name
  `, [groupIds])
  const { rows } = await withTransaction(query, transacting)
  return rows
}

/**
 * A page of the groups that have active members but no active Administrator,
 * most members first, as plain objects with their last post date and the
 * Moderators and Hosts who could take over. Returns { total, hasMore, items }.
 */
export async function findOrphanedGroups ({ first = 20, offset = 0, transacting } = {}) {
  const limit = Math.min(Math.max(Number(first) || 20, 1), 100)
  const skip = Math.max(Number(offset) || 0, 0)
  const { sql, bindings } = await orphanedGroupCondition(transacting)

  const pageQuery = bookshelf.knex.raw(`
    SELECT g.id, g.name, g.slug, g.avatar_url, g.created_at,
      (
        SELECT COUNT(*) FROM group_memberships m
        JOIN users mu ON mu.id = m.user_id AND mu.active = true
        WHERE m.group_id = g.id AND m.active = true
      ) AS member_count,
      (
        SELECT MAX(p.created_at) FROM groups_posts gp
        JOIN posts p ON p.id = gp.post_id AND p.active = true
        WHERE gp.group_id = g.id
      ) AS last_activity_at,
      COUNT(*) OVER () AS total
    FROM groups g
    WHERE ${sql}
    ORDER BY member_count DESC, g.id
    LIMIT ? OFFSET ?
  `, [...bindings, limit, skip])
  const { rows } = await withTransaction(pageQuery, transacting)

  const total = rows.length > 0 ? Number(rows[0].total) : await countOrphanedGroups({ transacting })
  const candidates = await stewardCandidates(rows.map(row => row.id), transacting)

  return {
    total,
    hasMore: skip + rows.length < total,
    items: rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      memberCount: Number(row.member_count),
      lastActivityAt: row.last_activity_at,
      candidates: candidates
        .filter(candidate => String(candidate.group_id) === String(row.id))
        .map(candidate => ({
          id: candidate.id,
          name: candidate.name,
          avatarUrl: candidate.avatar_url,
          roleName: candidate.role_name
        }))
    }))
  }
}

/**
 * Whether a group is an active top-level group with active members and no
 * active Administrator.
 */
export async function isOrphanedGroup (groupId, { transacting } = {}) {
  if (!groupId) return false
  const { sql, bindings } = await orphanedGroupCondition(transacting)
  const query = bookshelf.knex.raw(`SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = ? AND ${sql}) AS orphaned`, [groupId, ...bindings])
  const { rows } = await withTransaction(query, transacting)
  return !!rows[0].orphaned
}

/**
 * Up to `limit` active members of a group whose name matches `search`, as
 * plain objects { id, name, avatarUrl, roleName } (roleName is the first of
 * their active roles, if any).
 */
export async function searchActiveMembers (groupId, { search, limit = 20, transacting } = {}) {
  if (!groupId) return []
  const term = (search || '').trim()
  const query = bookshelf.knex.raw(`
    SELECT u.id, u.name, u.avatar_url,
      (
        SELECT gr.name FROM group_memberships_group_roles mgr
        JOIN groups_roles gr ON gr.id = mgr.group_role_id AND gr.active = true
        WHERE mgr.group_id = gm.group_id AND mgr.user_id = u.id AND mgr.active IS NOT FALSE
        ORDER BY gr.type = 'system' DESC, gr.name
        LIMIT 1
      ) AS role_name
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id AND u.active = true
    WHERE gm.group_id = ? AND gm.active = true
      AND (? = '' OR u.name ILIKE ?)
    ORDER BY lower(u.name), u.id
    LIMIT ?
  `, [groupId, term, `%${term.replace(/[\\%_]/g, c => `\\${c}`)}%`, Math.min(Math.max(Number(limit) || 20, 1), 50)])
  const { rows } = await withTransaction(query, transacting)
  return rows.map(row => ({ id: row.id, name: row.name, avatarUrl: row.avatar_url, roleName: row.role_name }))
}
