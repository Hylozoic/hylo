/* eslint-disable camelcase */
const RESP_ADMINISTRATION = 'Administration'
const RESP_ADD_MEMBERS = 'Add Members'
const RESP_INVITE_MEMBERS = 'Invite Members'
const RESP_REMOVE_MEMBERS = 'Remove Members'
const RESP_MANAGE_CONTENT = 'Manage Content'

// System responsibility ids never change once created, so they are cached per process
const systemIdCache = new Map()

module.exports = bookshelf.Model.extend({
  tableName: 'responsibilities',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  // responsiblities have a many-to-many relationship with group_roles
  groupRoles: function () {
    return this.belongsToMany(GroupRole, 'group_roles_responsibilities', 'group_role_id', 'responsibility_id')
  }
}, {
  constants: {
    RESP_ADD_MEMBERS,
    RESP_ADMINISTRATION,
    RESP_INVITE_MEMBERS,
    RESP_MANAGE_CONTENT,
    RESP_REMOVE_MEMBERS
  },

  // Users with these responsibilities we show to users in the sidebar of the group
  IMPORTANT_RESPONSIBILITIES: [RESP_ADMINISTRATION, RESP_REMOVE_MEMBERS, RESP_MANAGE_CONTENT],

  fetchAll: function ({ groupId = 0, groupRoleId }) {
    // Platform responsibilities in a fixed order (Administration first); custom after, by title.
    const orderByPlatformFirst = (query) => query.orderByRaw(`
      CASE type
        WHEN 'system' THEN 0
        ELSE 1
      END,
      CASE title
        WHEN ? THEN 0
        WHEN ? THEN 1
        WHEN ? THEN 2
        WHEN ? THEN 3
        WHEN ? THEN 4
        ELSE 5
      END,
      title ASC
    `, [RESP_ADMINISTRATION, RESP_ADD_MEMBERS, RESP_INVITE_MEMBERS, RESP_REMOVE_MEMBERS, RESP_MANAGE_CONTENT])

    if (groupRoleId) {
      return orderByPlatformFirst(
        bookshelf.knex('responsibilities')
          .join('group_roles_responsibilities', 'responsibilities.id', 'group_roles_responsibilities.responsibility_id')
          .where('group_roles_responsibilities.group_role_id', groupRoleId)
      )
    }
    return orderByPlatformFirst(
      bookshelf.knex('responsibilities').whereRaw('group_id is NULL or group_id = ?', groupId)
    )
  },

  /**
   * Id of the platform (type 'system') responsibility with this exact title, or null.
   * Use this to match a platform responsibility when a group-defined one could share its title.
   */
  async systemId (title, { transacting } = {}) {
    if (systemIdCache.has(title)) return systemIdCache.get(title)
    let query = bookshelf.knex('responsibilities')
      .where({ title, type: 'system' })
      .whereNull('group_id')
      .orderBy('id', 'asc')
      .first('id')
    if (transacting) query = query.transacting(transacting)
    const row = await query
    if (!row) return null
    systemIdCache.set(title, row.id)
    return row.id
  },

  /**
   * True if the title matches a platform responsibility title, ignoring case and surrounding spaces.
   */
  async isSystemTitle (title, { transacting } = {}) {
    const normalized = (title || '').trim().toLowerCase()
    if (!normalized) return false
    let query = bookshelf.knex('responsibilities')
      .where('type', 'system')
      .whereRaw('lower(trim(title)) = ?', [normalized])
      .first('id')
    if (transacting) query = query.transacting(transacting)
    return !!(await query)
  },

  /**
   * Responsibilities for a user in a group/space.
   * Spaces inherit role assignments from their parent group (COALESCE(parent_id, id)).
   */
  async fetchForUserAndGroupAsStrings (userId, groupId) {
    const roleScopeId = await Group.roleScopeId(groupId)
    return bookshelf.knex.raw(
      `WITH UserGroupRoles AS (
        SELECT group_role_id
        FROM group_memberships_group_roles
        WHERE user_id = ${userId}
          AND group_id = ${roleScopeId}
      ),
      ResponsibilitiesCTE AS (
        SELECT responsibility_id
        FROM group_roles_responsibilities
        WHERE group_role_id IN (SELECT group_role_id FROM UserGroupRoles)
      )
      SELECT title
      FROM responsibilities
      WHERE id IN (SELECT responsibility_id FROM ResponsibilitiesCTE);`
    ).then(resp => resp.rows.map(r => r.title))
  },

  fetchSystemResponsiblititesForUser (userId, groupIds = []) {
    return bookshelf.knex.raw(
      `WITH UserGroupRoles AS (
        SELECT
          m.group_role_id,
          m.group_id
        FROM group_memberships_group_roles m
        WHERE m.user_id = ${userId}
      ),
      ResponsibilitiesCTE AS (
        SELECT
          gr.responsibility_id,
          ugr.group_id,
          r.title
        FROM group_roles_responsibilities gr
        JOIN UserGroupRoles ugr ON gr.group_role_id = ugr.group_role_id
        JOIN responsibilities r ON gr.responsibility_id = r.id AND r.type = 'system'
      )
      SELECT
        r.responsibility_id,
        r.group_id,
        r.title
      FROM ResponsibilitiesCTE r
      ORDER BY r.group_id;`
    ).then(resp => {
      if (groupIds.length === 0) return resp.rows
      return resp.rows.filter(r => groupIds.includes(r.group_id))
    })
  },

  /**
   * System responsibilities held by members of a group/space.
   * Spaces resolve role assignments against the parent group.
   */
  async fetchForGroup (groupId) {
    const roleScopeId = await Group.roleScopeId(groupId)
    return bookshelf.knex.raw(
      `SELECT DISTINCT
        r.title AS responsibility_title,
        m.user_id
      FROM responsibilities r
      JOIN group_roles_responsibilities gr ON r.id = gr.responsibility_id
      JOIN group_memberships_group_roles m ON gr.group_role_id = m.group_role_id
      WHERE r.type = 'system' AND m.group_id = ${roleScopeId};`
    ).then(resp => resp.rows)
  },

  hasAllResponsibilities (rows) {
    const userCounts = rows.reduce((acc, row) => {
      const { user_id } = row
      acc[user_id] = (acc[user_id] || 0) + 1
      return acc
    }, {})

    return Object.entries(userCounts)
      .filter(([_, count]) => count >= 3)
      .map(([user_id]) => parseInt(user_id, 10))
  }
})
