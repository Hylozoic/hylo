/* eslint-disable camelcase */
import { GraphQLError } from 'graphql'
import { isFeatureEnabled, MEMBER_INVITES } from '../../lib/featureFlags'

const TYPE_MEMBER = 'member'

// Every top-level group has one implicit Member role. Nobody is assigned it:
// every active member holds it, so it has no group_memberships_group_roles rows.
const MEMBER_ROLE = {
  name: 'Member',
  emoji: '',
  description: 'Everyone in the group holds this role.'
}

// Who can invite new people, stored as the set of this group's roles linked to
// the system Invite Members responsibility:
// everyone = the Member role, stewards = none, roles = the chosen roles.
const InvitePolicy = {
  EVERYONE: 'everyone',
  STEWARDS: 'stewards',
  ROLES: 'roles'
}

const DEFAULT_NEW_GROUP_INVITE_POLICY = Object.freeze({ mode: InvitePolicy.STEWARDS })

const MEMBER_INVITES_UNAVAILABLE_ERROR = 'Invitations from members are not available yet'

const MEMBER_ROLE_LOCKED_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'

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

/**
 * Ids of this group's active system or custom roles named by roleIds and
 * systemRoleNames. Throws if any of them is not one.
 */
async function resolveInvitePolicyRoleIds (groupId, { roleIds, systemRoleNames }, transacting) {
  const ids = new Set()

  for (const name of systemRoleNames || []) {
    if (!SYSTEM_ROLES.some(roleDef => roleDef.name === name)) {
      throw new GraphQLError(`Unknown system role: ${name}`)
    }
    const role = await GroupRole.findSystemRole(groupId, name, { transacting })
    if (!role || !role.get('active')) {
      throw new GraphQLError(`This group has no active ${name} role`)
    }
    ids.add(String(role.id))
  }

  const requestedIds = [...new Set((roleIds || []).map(parseRoleId))]
  if (requestedIds.length > 0) {
    if (requestedIds.includes(null)) {
      throw new GraphQLError('Invite policy roles must be active roles in this group')
    }
    let query = bookshelf.knex('groups_roles')
      .whereIn('id', requestedIds)
      .where({ group_id: groupId, active: true })
      .whereIn('type', [GroupRole.TYPE_SYSTEM, GroupRole.TYPE_CUSTOM])
      .pluck('id')
    if (transacting) query = query.transacting(transacting)
    const found = await query
    if (found.length !== requestedIds.length) {
      throw new GraphQLError('Invite policy roles must be active roles in this group')
    }
    found.forEach(id => ids.add(String(id)))
  }

  return [...ids].map(Number)
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
    if (this.get('type') === TYPE_MEMBER) {
      throw new GraphQLError('The Member role cannot grant scopes')
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
  MEMBER_ROLE,
  TYPE_SYSTEM: 'system',
  TYPE_CUSTOM: 'custom',
  TYPE_MEMBER,
  InvitePolicy,
  DEFAULT_NEW_GROUP_INVITE_POLICY,
  MEMBER_INVITES_UNAVAILABLE_ERROR,
  MEMBER_ROLE_LOCKED_ERROR,

  /**
   * Whether members can be given invite access at all: while this is off only
   * the 'stewards' policy can be set and nobody has limited invite access.
   */
  memberInvitesEnabled: function () {
    return isFeatureEnabled(MEMBER_INVITES)
  },

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

    await GroupRole.ensureMemberRole(groupId, { transacting })

    return roleIdByName
  },

  /**
   * The group's implicit Member role, or null (spaces have none, and groups
   * created before it existed get one lazily from ensureMemberRole).
   */
  findMemberRole: async function (groupId, { transacting } = {}) {
    if (!groupId) return null
    return GroupRole.where({ group_id: groupId, type: TYPE_MEMBER }).fetch({ transacting })
  },

  /**
   * Create the Member role for a top-level group if it does not exist yet, and
   * return it. Never links responsibilities to it. Safe to call concurrently.
   * Returns null for spaces and missing groups.
   */
  ensureMemberRole: async function (groupId, { transacting } = {}) {
    const group = await fetchGroupRow(groupId, transacting)
    if (!isTopLevelGroupRow(group)) return null

    // The ON CONFLICT predicate must be a literal to match the partial unique index
    let insertQuery = bookshelf.knex.raw(`
      INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'member', true, now(), now())
      ON CONFLICT (group_id) WHERE type = 'member' DO NOTHING
    `, [group.id, MEMBER_ROLE.name, MEMBER_ROLE.emoji, MEMBER_ROLE.description])
    if (transacting) insertQuery = insertQuery.transacting(transacting)
    await insertQuery

    return GroupRole.findMemberRole(group.id, { transacting })
  },

  parseRoleId,

  /**
   * Throw if any of these role ids is an implicit Member role, which cannot be
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
      .where('type', TYPE_MEMBER)
      .first('id')
    if (transacting) query = query.transacting(transacting)
    if (await query) {
      throw new GraphQLError(MEMBER_ROLE_LOCKED_ERROR)
    }
  },

  /**
   * Who can invite new people to a top-level group, as { mode, roleIds }, read
   * from which of its active roles are linked to the system Invite Members
   * responsibility. Roles that also hold Add Members could invite anyway, so
   * linking only those still reads as 'stewards'. Null for spaces and missing groups.
   */
  getInvitePolicy: async function (groupId, { transacting } = {}) {
    const group = await fetchGroupRow(groupId, transacting)
    if (!isTopLevelGroupRow(group)) return null

    const inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS, { transacting })
    if (!inviteMembersId) return { mode: InvitePolicy.STEWARDS, roleIds: [] }
    const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS, { transacting })

    let query = bookshelf.knex.raw(`
      SELECT DISTINCT gr.id, gr.type,
        EXISTS (
          SELECT 1 FROM group_roles_responsibilities am
          WHERE am.group_role_id = gr.id AND am.responsibility_id = ?
        ) AS holds_add_members
      FROM groups_roles gr
      JOIN group_roles_responsibilities grr ON grr.group_role_id = gr.id AND grr.responsibility_id = ?
      WHERE gr.group_id = ? AND gr.active = true
      ORDER BY gr.id
    `, [addMembersId, inviteMembersId, group.id])
    if (transacting) query = query.transacting(transacting)
    const { rows } = await query

    if (rows.some(row => row.type === TYPE_MEMBER)) {
      return { mode: InvitePolicy.EVERYONE, roleIds: [] }
    }
    if (rows.some(row => !row.holds_add_members)) {
      return { mode: InvitePolicy.ROLES, roleIds: rows.map(row => row.id) }
    }
    return { mode: InvitePolicy.STEWARDS, roleIds: [] }
  },

  /**
   * Set who can invite new people to a top-level group by linking Invite Members
   * to exactly: the Member role (everyone), no role (stewards), or the chosen
   * roles (roles). Chosen roles come from roleIds and from systemRoleNames (such
   * as 'Moderator', for a group being created whose role ids the caller does not
   * know yet), and must be this group's active system or custom roles.
   * 'everyone' and 'roles' are refused unless memberInvitesEnabled().
   * Returns the resulting policy.
   */
  setInvitePolicy: async function (groupId, { mode, roleIds, systemRoleNames } = {}, { transacting } = {}) {
    if (!transacting) {
      return bookshelf.transaction(trx =>
        GroupRole.setInvitePolicy(groupId, { mode, roleIds, systemRoleNames }, { transacting: trx }))
    }
    if (!Object.values(InvitePolicy).includes(mode)) {
      throw new GraphQLError('Unknown invite policy mode')
    }
    if (mode !== InvitePolicy.STEWARDS && !GroupRole.memberInvitesEnabled()) {
      throw new GraphQLError(MEMBER_INVITES_UNAVAILABLE_ERROR)
    }
    const group = await fetchGroupRow(groupId, transacting)
    if (!group) throw new GraphQLError('Group not found')
    if (!isTopLevelGroupRow(group)) {
      throw new GraphQLError('Only top-level groups have an invite policy')
    }

    // group_roles_responsibilities has no unique constraint, so concurrent
    // changes to one group must not interleave their reads and inserts
    await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`group-invite-policy:${group.id}`])
      .transacting(transacting)

    let targetRoleIds = []
    if (mode === InvitePolicy.EVERYONE) {
      const memberRole = await GroupRole.ensureMemberRole(group.id, { transacting })
      targetRoleIds = [memberRole.id]
    } else if (mode === InvitePolicy.ROLES) {
      targetRoleIds = await resolveInvitePolicyRoleIds(group.id, { roleIds, systemRoleNames }, transacting)
    }

    const inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS, { transacting })
    if (!inviteMembersId) {
      if (targetRoleIds.length > 0) throw new GraphQLError('The Invite Members responsibility is missing')
      return GroupRole.getInvitePolicy(group.id, { transacting })
    }

    const groupRoleIds = bookshelf.knex('groups_roles').select('id').where('group_id', group.id)
    const linkedRoleIds = await bookshelf.knex('group_roles_responsibilities')
      .where('responsibility_id', inviteMembersId)
      .whereIn('group_role_id', groupRoleIds)
      .pluck('group_role_id')
      .transacting(transacting)

    await bookshelf.knex('group_roles_responsibilities')
      .where('responsibility_id', inviteMembersId)
      .whereIn('group_role_id', groupRoleIds)
      .whereNotIn('group_role_id', targetRoleIds)
      .del()
      .transacting(transacting)

    const linked = new Set(linkedRoleIds.map(String))
    const toLink = targetRoleIds.filter(id => !linked.has(String(id)))
    if (toLink.length > 0) {
      await bookshelf.knex('group_roles_responsibilities')
        .insert(toLink.map(id => ({ group_role_id: id, responsibility_id: inviteMembersId })))
        .transacting(transacting)
    }

    return GroupRole.getInvitePolicy(group.id, { transacting })
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
