/* global bookshelf */
/*
  Who counts as a steward of a group, for steward notices and for the Stewards
  list on the About page (D13, D38, M3).

  A steward is an active member with an active account who holds an active
  Administrator (legacy name Coordinator), Moderator or Host system role. It is
  never decided by a responsibility such as Add Members, which the Member role
  may one day give to everyone. Roles live on the top-level group, so for a
  space the roles are read on its parent, while the person must still be a
  member of the space itself (as with Group#moderators for spaces).
*/

// Current and legacy names of the steward system roles (GroupRole.SYSTEM_ROLES)
export const STEWARD_ROLE_NAMES = ['Administrator', 'Coordinator', 'Moderator', 'Host']

/**
 * SQL condition (and bindings) that is true when the user whose id is in
 * userIdSql holds an active steward role for the group whose id is in groupIdSql,
 * resolved on the parent for spaces.
 */
export function stewardRoleCondition (userIdSql, groupIdSql) {
  return {
    sql: `EXISTS (
      SELECT 1 FROM group_memberships_group_roles steward_mgr
      JOIN groups_roles steward_gr ON steward_gr.id = steward_mgr.group_role_id
        AND steward_gr.group_id = steward_mgr.group_id
        AND steward_gr.active = true
        AND steward_gr.type = 'system'
        AND steward_gr.name IN (${STEWARD_ROLE_NAMES.map(() => '?').join(', ')})
      WHERE steward_mgr.user_id = ${userIdSql}
        AND steward_mgr.active IS NOT FALSE
        AND steward_mgr.group_id = (
          SELECT COALESCE(steward_g.parent_id, steward_g.id) FROM groups steward_g WHERE steward_g.id = ${groupIdSql}
        )
    )`,
    bindings: [...STEWARD_ROLE_NAMES]
  }
}

/**
 * The group's stewards as a relation on its members (active members with active
 * accounts), for GraphQL and anything that wants a Bookshelf collection.
 */
export function stewardsRelation (group) {
  return group.members().query(q => {
    const { sql, bindings } = stewardRoleCondition('users.id', '?')
    q.whereRaw(sql, [...bindings, group.id])
  })
}

/**
 * Ids of the group's stewards, as strings, leaving out excludeUserIds.
 */
export async function stewardIds (groupId, { excludeUserIds = [], transacting } = {}) {
  if (!groupId) return []
  const { sql, bindings } = stewardRoleCondition('gm.user_id', 'gm.group_id')
  const excluded = excludeUserIds.filter(id => id != null).map(String)
  let query = bookshelf.knex.raw(`
    SELECT DISTINCT gm.user_id
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id AND u.active = true
    WHERE gm.group_id = ? AND gm.active = true AND ${sql}
    ORDER BY gm.user_id
  `, [groupId, ...bindings])
  if (transacting) query = query.transacting(transacting)
  const { rows } = await query
  return rows.map(row => String(row.user_id)).filter(id => !excluded.includes(id))
}

/**
 * Whether this person is a steward of the group.
 */
export async function isSteward (userId, groupId, { transacting } = {}) {
  if (!userId || !groupId) return false
  const ids = await stewardIds(groupId, { transacting })
  return ids.includes(String(userId))
}
