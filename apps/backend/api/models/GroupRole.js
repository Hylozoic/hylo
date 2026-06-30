/* eslint-disable camelcase */

const SYSTEM_ROLES = [
  {
    name: 'Coordinator',
    emoji: '🪄',
    description: 'Coordinators are empowered to do everything related to group administration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds']
  },
  {
    name: 'Moderator',
    emoji: '⚖️',
    description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
    responsibilities: ['Manage Content', 'Remove Members']
  },
  {
    name: 'Host',
    emoji: '👋',
    description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people.',
    responsibilities: ['Add Members']
  }
]

module.exports = bookshelf.Model.extend({
  tableName: 'groups_roles',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  responsibilities: function () {
    return this.belongsToMany(Responsibility, 'group_roles_responsibilities', 'group_role_id', 'responsibility_id')
  },

  /**
   * Get the scope strings that this role grants
   * @returns {Array<String>} Array of scope strings (e.g., ['group:123', 'track:456'])
   */
  getScopes: function () {
    const scopes = this.get('scopes')
    // scopes is a JSONB array, return it or empty array if null
    return scopes || []
  },

  /**
   * Set the scopes for this role
   * Note: This will trigger database triggers to update user_scopes for all users with this role
   * @param {Array<String>} scopeStrings - Array of scope strings
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  setScopes: async function (scopeStrings, { transacting } = {}) {
    return this.save({ scopes: scopeStrings }, { transacting })
  },

  /**
   * Add a scope to this role
   * @param {String} scopeString - Scope string to add
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  addScope: async function (scopeString, { transacting } = {}) {
    const currentScopes = this.getScopes()
    if (!currentScopes.includes(scopeString)) {
      currentScopes.push(scopeString)
      return this.setScopes(currentScopes, { transacting })
    }
    return this
  },

  /**
   * Remove a scope from this role
   * @param {String} scopeString - Scope string to remove
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  removeScope: async function (scopeString, { transacting } = {}) {
    const currentScopes = this.getScopes()
    const filtered = currentScopes.filter(s => s !== scopeString)
    if (filtered.length !== currentScopes.length) {
      return this.setScopes(filtered, { transacting })
    }
    return this
  }

}, {
  SYSTEM_ROLES,
  TYPE_SYSTEM: 'system',
  TYPE_CUSTOM: 'custom',

  /**
   * Create system roles (Coordinator, Moderator, Host) for a group if they do not exist yet.
   * Links responsibilities by name (type = system). Idempotent.
   */
  setupSystemRoles: async function (groupId, { transacting } = {}) {
    const responsibilityRows = await Responsibility.query(q => {
      q.where('type', 'system')
    }).fetchAll({ transacting })

    const responsibilityByName = {}
    responsibilityRows.forEach(r => {
      responsibilityByName[r.get('title')] = r.id
    })

    const now = new Date()
    const roleIdByName = {}

    for (const roleDef of SYSTEM_ROLES) {
      let role = await GroupRole.where({
        group_id: groupId,
        name: roleDef.name,
        type: GroupRole.TYPE_SYSTEM
      }).fetch({ transacting })

      if (!role) {
        role = await GroupRole.forge({
          group_id: groupId,
          name: roleDef.name,
          emoji: roleDef.emoji,
          description: roleDef.description,
          type: GroupRole.TYPE_SYSTEM,
          active: true,
          created_at: now,
          updated_at: now
        }).save(null, { transacting })
      }

      roleIdByName[roleDef.name] = role.id

      const respIds = roleDef.responsibilities
        .map(title => responsibilityByName[title])
        .filter(Boolean)

      for (const responsibilityId of respIds) {
        let linkQuery = bookshelf.knex('group_roles_responsibilities')
          .where({ group_role_id: role.id, responsibility_id: responsibilityId })
          .first()
        if (transacting) linkQuery = linkQuery.transacting(transacting)
        const exists = await linkQuery

        if (!exists) {
          let insertQuery = bookshelf.knex('group_roles_responsibilities')
            .insert({ group_role_id: role.id, responsibility_id: responsibilityId })
          if (transacting) insertQuery = insertQuery.transacting(transacting)
          await insertQuery
        }
      }
    }

    return roleIdByName
  },

  /**
   * Find a system role by name for a group.
   */
  findSystemRole: function (groupId, roleName, { transacting } = {}) {
    return GroupRole.where({
      group_id: groupId,
      name: roleName,
      type: GroupRole.TYPE_SYSTEM
    }).fetch({ transacting })
  }
})
