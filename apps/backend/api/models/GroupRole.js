/* eslint-disable camelcase */
import { GraphQLError } from 'graphql'

const TYPE_ALL_MEMBERS = 'all_members'

// Every top-level group has one implicit All Members role. Nobody is assigned it:
// every active member holds it, through the group_member_effective_roles view.
const ALL_MEMBERS_ROLE = {
  name: 'All Members',
  emoji: '',
  description: 'Everyone in the group holds this role.'
}

// Who can invite new people: 'everyone' links Add Members to the All Members
// role, 'stewards' leaves Add Members only on the roles that already have it.
const InvitePolicy = {
  EVERYONE: 'everyone',
  STEWARDS: 'stewards'
}

const DEFAULT_NEW_GROUP_INVITE_POLICY = InvitePolicy.STEWARDS

const ALL_MEMBERS_ROLE_LOCKED_ERROR = 'The All Members role cannot be edited, assigned or used as a requirement'

const MAX_INTEGER_ID = 2147483647

/**
 * A role id (or an { id } object) as a number, or null unless it is written as
 * plain decimal digits. Postgres also reads forms such as '+4', '0x04' and
 * '4_0' as integers, so anything else could name a row a check never looked at.
 */
function parseRoleId (value) {
  const id = (value != null && typeof value === 'object') ? value.id : value
  if (typeof id !== 'number' && typeof id !== 'string') return null
  const digits = String(id).trim()
  if (!/^\d{1,10}$/.test(digits) || Number(digits) > MAX_INTEGER_ID) return null
  return Number(digits)
}

async function fetchGroupRow (groupId, transacting) {
  if (!groupId) return null
  let query = bookshelf.knex('groups').where('id', groupId).first('id', 'parent_id', 'type')
  if (transacting) query = query.transacting(transacting)
  return query
}

function isTopLevelGroupRow (group) {
  return !!group && !group.parent_id && group.type !== 'space'
}

const SYSTEM_ROLES = [
  {
    name: 'Administrator',
    legacyNames: ['Coordinator'],
    emoji: '🪄',
    description: 'Administrators are empowered to do all group management and configuration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content']
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
    if (this.get('type') === TYPE_ALL_MEMBERS) {
      throw new GraphQLError('The All Members role cannot grant scopes')
    }
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
  ALL_MEMBERS_ROLE,
  TYPE_SYSTEM: 'system',
  TYPE_CUSTOM: 'custom',
  TYPE_ALL_MEMBERS,
  InvitePolicy,
  DEFAULT_NEW_GROUP_INVITE_POLICY,
  ALL_MEMBERS_ROLE_LOCKED_ERROR,

  /**
   * Map a stored system role name (including legacy names) to the current name.
   */
  canonicalSystemRoleName: function (name) {
    const roleDef = SYSTEM_ROLES.find(r => r.name === name || r.legacyNames?.includes(name))
    return roleDef ? roleDef.name : name
  },

  /**
   * Create system roles (Administrator, Moderator, Host) for a group if they do not exist yet.
   * Links responsibilities by name (type = system). Idempotent.
   * No-op for spaces — they inherit roles from the parent group.
   */
  setupSystemRoles: async function (groupId, { transacting } = {}) {
    const roleScopeId = await Group.roleScopeId(groupId, { transacting })
    if (String(roleScopeId) !== String(groupId)) return

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

      if (!role && roleDef.legacyNames) {
        for (const legacyName of roleDef.legacyNames) {
          role = await GroupRole.where({
            group_id: groupId,
            name: legacyName,
            type: GroupRole.TYPE_SYSTEM
          }).fetch({ transacting })
          if (role) {
            await role.save({ name: roleDef.name }, { transacting, patch: true })
            break
          }
        }
      }

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

    await GroupRole.ensureAllMembersRole(groupId, { transacting })

    return roleIdByName
  },

  /**
   * The group's implicit All Members role, or null. Spaces have none.
   */
  findAllMembersRole: async function (groupId, { transacting } = {}) {
    if (!groupId) return null
    return GroupRole.where({ group_id: groupId, type: TYPE_ALL_MEMBERS }).fetch({ transacting })
  },

  /**
   * Create the All Members role for a top-level group if it does not exist yet,
   * and return it. Safe to call concurrently. Returns null for spaces and missing groups.
   */
  ensureAllMembersRole: async function (groupId, { transacting } = {}) {
    const group = await fetchGroupRow(groupId, transacting)
    if (!isTopLevelGroupRow(group)) return null

    // The ON CONFLICT predicate must be a literal to match the partial unique index
    let insertQuery = bookshelf.knex.raw(`
      INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'all_members', true, now(), now())
      ON CONFLICT (group_id) WHERE type = 'all_members' DO NOTHING
    `, [group.id, ALL_MEMBERS_ROLE.name, ALL_MEMBERS_ROLE.emoji, ALL_MEMBERS_ROLE.description])
    if (transacting) insertQuery = insertQuery.transacting(transacting)
    await insertQuery

    return GroupRole.findAllMembersRole(group.id, { transacting })
  },

  parseRoleId,

  /**
   * Throw if any of these role ids is the All Members role, which cannot be
   * edited, assigned to people or used as a requirement, or is not written as
   * plain decimal digits. Accepts ids or { id } objects; null, undefined and ''
   * mean no role and are skipped.
   */
  assertAssignableRoleIds: async function (roleIds, { transacting } = {}) {
    const ids = [].concat(roleIds ?? [])
      .filter(id => id != null && id !== '')
      .map(parseRoleId)
    if (ids.includes(null)) throw new GraphQLError('Invalid role id')
    if (ids.length === 0) return

    let query = bookshelf.knex('groups_roles')
      .whereIn('id', ids)
      .where('type', TYPE_ALL_MEMBERS)
      .first('id')
    if (transacting) query = query.transacting(transacting)
    if (await query) {
      throw new GraphQLError(ALL_MEMBERS_ROLE_LOCKED_ERROR)
    }
  },

  /**
   * Who can invite new people to a top-level group: 'everyone' when Add Members
   * is linked to the All Members role, otherwise 'stewards'. Null for spaces.
   */
  getInvitePolicy: async function (groupId, { transacting } = {}) {
    const group = await fetchGroupRow(groupId, transacting)
    if (!isTopLevelGroupRow(group)) return null

    const allMembers = await GroupRole.findAllMembersRole(group.id, { transacting })
    if (!allMembers) return InvitePolicy.STEWARDS
    const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS, { transacting })
    if (!addMembersId) return InvitePolicy.STEWARDS

    let query = bookshelf.knex('group_roles_responsibilities')
      .where({ group_role_id: allMembers.id, responsibility_id: addMembersId })
      .first('group_role_id')
    if (transacting) query = query.transacting(transacting)
    return (await query) ? InvitePolicy.EVERYONE : InvitePolicy.STEWARDS
  },

  /**
   * Set who can invite new people by linking or unlinking Add Members on the
   * All Members role. Other roles that hold Add Members are left alone.
   * Returns the resulting policy.
   */
  setInvitePolicy: async function (groupId, mode, { transacting } = {}) {
    if (!transacting) {
      return bookshelf.transaction(trx =>
        GroupRole.setInvitePolicy(groupId, mode, { transacting: trx }))
    }
    if (!Object.values(InvitePolicy).includes(mode)) {
      throw new GraphQLError('Unknown invite policy')
    }
    const group = await fetchGroupRow(groupId, transacting)
    if (!group) throw new GraphQLError('Group not found')
    if (!isTopLevelGroupRow(group)) {
      throw new GraphQLError('Only top-level groups have an invite policy')
    }

    await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`group-invite-policy:${group.id}`])
      .transacting(transacting)

    const allMembers = await GroupRole.ensureAllMembersRole(group.id, { transacting })
    const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS, { transacting })
    if (!addMembersId || !allMembers) return GroupRole.getInvitePolicy(group.id, { transacting })

    const existing = await bookshelf.knex('group_roles_responsibilities')
      .where({ group_role_id: allMembers.id, responsibility_id: addMembersId })
      .first('group_role_id')
      .transacting(transacting)

    if (mode === InvitePolicy.EVERYONE && !existing) {
      await bookshelf.knex('group_roles_responsibilities')
        .insert({ group_role_id: allMembers.id, responsibility_id: addMembersId })
        .transacting(transacting)
    }
    if (mode === InvitePolicy.STEWARDS && existing) {
      await bookshelf.knex('group_roles_responsibilities')
        .where({ group_role_id: allMembers.id, responsibility_id: addMembersId })
        .del()
        .transacting(transacting)
    }

    return mode
  },

  /**
   * Find a system role by current or legacy name for a group.
   */
  findSystemRole: async function (groupId, roleName, { transacting } = {}) {
    const roleDef = SYSTEM_ROLES.find(r => r.name === roleName || r.legacyNames?.includes(roleName))
    const names = roleDef
      ? [roleDef.name, ...(roleDef.legacyNames || [])]
      : [roleName]

    for (const name of [...new Set(names)]) {
      const role = await GroupRole.where({
        group_id: groupId,
        name,
        type: GroupRole.TYPE_SYSTEM
      }).fetch({ transacting })
      if (role) return role
    }

    return null
  }
})
