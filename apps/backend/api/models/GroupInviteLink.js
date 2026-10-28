/* eslint-disable camelcase */
import { GraphQLError } from 'graphql'
import randomstring from 'randomstring'

const CODE_PATTERN = /^[A-Za-z0-9]{10}$/

function isSpaceRow (group) {
  return !!group && (group.get('type') === 'space' || !!group.get('parent_id'))
}

function isOpenTopLevel (group) {
  return !!group && !isSpaceRow(group) && Number(group.get('accessibility')) === Group.Accessibility.OPEN
}

/**
 * Public Open groups keep one default link and do not show invite links.
 * Protected and hidden Open groups can have more links created, edited, and deleted.
 */
function openLinksAreReadOnly (group) {
  return isOpenTopLevel(group) && Number(group.get('visibility')) === Group.Visibility.PUBLIC
}

/**
 * A reusable invite link for a group or space.
 * grant_access lets the person join regardless of accessibility. Links that do
 * not grant access only make a Restricted group viewable.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'group_invite_links',
  requireFetch: false,

  // Knex binds a JS array as a Postgres array (`{58}`), which is invalid jsonb.
  format (attrs) {
    const formatted = Object.assign({}, attrs)
    if (Array.isArray(formatted.granted_roles)) {
      formatted.granted_roles = JSON.stringify(formatted.granted_roles)
    }
    return formatted
  },

  // RETURNING can hand the stringified array back. GraphQL needs a real array.
  parse (response) {
    if (typeof response.granted_roles === 'string') {
      try {
        const parsed = JSON.parse(response.granted_roles)
        if (Array.isArray(parsed)) response.granted_roles = parsed
      } catch (e) {}
    }
    return response
  },

  group: function () {
    return this.belongsTo(Group)
  },

  creator: function () {
    return this.belongsTo(User, 'created_by_id')
  },

  grantedRoleIds: function () {
    let raw = this.get('granted_roles')
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch (e) {
        raw = []
      }
    }
    const ids = Array.isArray(raw) ? raw : []
    return ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
  }
}, {
  /**
   * Whether following this link joins the group, given the group's current
   * accessibility. Open and Closed groups, and every space, always grant access.
   */
  grantsAccess: function (link, group) {
    if (!link || !group) return false
    if (isSpaceRow(group)) return true
    const accessibility = Number(group.get('accessibility'))
    if (accessibility === Group.Accessibility.OPEN || accessibility === Group.Accessibility.CLOSED) return true
    return !!link.get('grant_access')
  },

  /**
   * 10-character code, unique across invite links and leftover groups.access_code values.
   */
  generateCode: async function ({ transacting } = {}) {
    const taken = async code => {
      let linkQuery = bookshelf.knex('group_invite_links').whereRaw('lower(access_code) = lower(?)', [code]).first('id')
      let groupQuery = bookshelf.knex('groups').whereRaw('lower(access_code) = lower(?)', [code]).first('id')
      if (transacting) {
        linkQuery = linkQuery.transacting(transacting)
        groupQuery = groupQuery.transacting(transacting)
      }
      return !!(await linkQuery) || !!(await groupQuery)
    }
    const loop = async () => {
      const code = randomstring.generate({ length: 10, charset: 'alphanumeric' })
      return (await taken(code)) ? loop() : code
    }
    return loop()
  },

  findActiveByCode: async function (accessCode, { transacting } = {}) {
    if (!accessCode) return null
    return GroupInviteLink.query(q => {
      q.whereRaw('lower(access_code) = lower(?)', accessCode)
      q.whereNull('deleted_at')
    }).fetch({ transacting, require: false })
  },

  /**
   * Active links for a group, oldest first. The first one that grants access
   * is the default link shown for Open groups and to older clients.
   */
  forGroup: function (groupId, { transacting } = {}) {
    return GroupInviteLink.query(q => {
      q.where('group_id', groupId)
      q.whereNull('deleted_at')
      q.orderBy('created_at', 'asc')
      q.orderBy('id', 'asc')
    }).fetchAll({ transacting })
  },

  /**
   * Create a link. Public Open groups are refused unless system is true
   * (the default link created with a new group or space). Only a Restricted
   * top-level group can have grant_access false, and only links that grant
   * access can grant roles.
   */
  createForGroup: async function (groupId, { userId, accessCode, name, grantAccess = true, grantedRoleIds, system = false } = {}, { transacting } = {}) {
    const group = await Group.where({ id: groupId }).fetch({ transacting, require: false })
    if (!group) throw new GraphQLError('Group not found')
    if (openLinksAreReadOnly(group) && !system) {
      throw new GraphQLError('Open groups do not have invite links to create')
    }

    const restricted = !isSpaceRow(group) && Number(group.get('accessibility')) === Group.Accessibility.RESTRICTED
    const grants = restricted ? !!grantAccess : true
    const roleIds = await resolveGrantedRoleIds(group, grants ? grantedRoleIds : [], transacting)
    if (!grants && (grantedRoleIds || []).length > 0) {
      throw new GraphQLError('Only a link that grants access can assign roles')
    }

    const code = (accessCode || '').trim()
    if (!CODE_PATTERN.test(code)) throw new GraphQLError('Invite link code must be 10 letters or digits')
    if (await codeIsTaken(code, transacting, group.id)) {
      throw new GraphQLError('That invite link code is already in use')
    }

    const trimmedName = (name || '').trim()
    return GroupInviteLink.forge({
      group_id: group.id,
      access_code: code,
      name: trimmedName || null,
      grant_access: grants,
      granted_roles: roleIds,
      num_joined_users: 0,
      created_by_id: userId || null,
      created_at: new Date()
    }).save(null, { transacting })
  },

  /**
   * Change the name, whether the link grants access, and the roles it assigns.
   * Public Open groups cannot be edited. Only a Restricted group can turn
   * grant access off.
   */
  updateLink: async function (link, { name, grantAccess, grantedRoleIds } = {}, { transacting } = {}) {
    if (link.get('deleted_at')) throw new GraphQLError('Invite link not found')
    const group = await link.group().fetch({ transacting })
    if (!group) throw new GraphQLError('Group not found')
    if (openLinksAreReadOnly(group)) {
      throw new GraphQLError('Open groups cannot edit their invite link')
    }

    const restricted = !isSpaceRow(group) && Number(group.get('accessibility')) === Group.Accessibility.RESTRICTED
    const grants = restricted ? !!grantAccess : true
    if (!grants && (grantedRoleIds || []).length > 0) {
      throw new GraphQLError('Only a link that grants access can assign roles')
    }
    const roleIds = await resolveGrantedRoleIds(group, grants ? grantedRoleIds : [], transacting)
    const trimmedName = (name || '').trim()
    return link.save({
      name: trimmedName || null,
      grant_access: grants,
      granted_roles: roleIds
    }, { patch: true, transacting })
  },

  softDelete: async function (link, userId, { transacting } = {}) {
    const group = await link.group().fetch({ transacting })
    if (openLinksAreReadOnly(group)) {
      throw new GraphQLError('Open groups cannot delete their invite link')
    }
    return link.save({
      deleted_at: new Date(),
      deleted_by_id: userId || null
    }, { patch: true, transacting })
  },

  /**
   * After someone joins through this link: remember the link on their
   * membership, assign its active roles, and count the join. Roles that have
   * been deactivated are skipped.
   */
  recordJoin: async function (link, userId, { transacting } = {}) {
    const group = await link.group().fetch({ transacting })
    const roleScopeId = await Group.roleScopeId(group.id, { transacting })
    const roleIds = link.grantedRoleIds()
    if (roleIds.length > 0 && GroupInviteLink.grantsAccess(link, group)) {
      let rolesQuery = bookshelf.knex('groups_roles')
        .whereIn('id', roleIds)
        .where({ group_id: roleScopeId, active: true })
        .whereIn('type', [GroupRole.TYPE_SYSTEM, GroupRole.TYPE_CUSTOM])
        .pluck('id')
      if (transacting) rolesQuery = rolesQuery.transacting(transacting)
      const activeIds = await rolesQuery
      for (const groupRoleId of activeIds) {
        const already = await MemberGroupRole.where({
          user_id: userId,
          group_id: roleScopeId,
          group_role_id: groupRoleId
        }).fetch({ transacting, require: false })
        if (already) continue
        await MemberGroupRole.forge({
          user_id: userId,
          group_id: roleScopeId,
          group_role_id: groupRoleId,
          active: true
        }).save(null, { transacting })
      }
    }
    const membership = await GroupMembership.forPair(userId, link.get('group_id'), { includeInactive: true }).fetch({ transacting })
    if (membership) {
      await membership.save({ group_invite_link_id: link.id }, { patch: true, transacting })
    }
    const count = Number(link.get('num_joined_users') || 0) + 1
    return link.save({ num_joined_users: count }, { patch: true, transacting })
  }
})

/**
 * Active system or custom role ids of the group's role scope. The All Members
 * role is never granted by a link.
 */
async function codeIsTaken (code, transacting, exceptGroupId) {
  let linkQuery = bookshelf.knex('group_invite_links').whereRaw('lower(access_code) = lower(?)', [code]).first('id')
  let groupQuery = bookshelf.knex('groups').whereRaw('lower(access_code) = lower(?)', [code])
  if (exceptGroupId) groupQuery = groupQuery.whereNot('id', exceptGroupId)
  groupQuery = groupQuery.first('id')
  if (transacting) {
    linkQuery = linkQuery.transacting(transacting)
    groupQuery = groupQuery.transacting(transacting)
  }
  return !!(await linkQuery) || !!(await groupQuery)
}

async function resolveGrantedRoleIds (group, grantedRoleIds, transacting) {
  const requested = [...new Set((grantedRoleIds || []).map(GroupRole.parseRoleId))]
  if (requested.length === 0) return []
  if (requested.includes(null)) throw new GraphQLError('Invite link roles must be active roles in this group')
  const roleScopeId = await Group.roleScopeId(group.id, { transacting })
  let query = bookshelf.knex('groups_roles')
    .whereIn('id', requested)
    .where({ group_id: roleScopeId, active: true })
    .whereIn('type', [GroupRole.TYPE_SYSTEM, GroupRole.TYPE_CUSTOM])
    .pluck('id')
  if (transacting) query = query.transacting(transacting)
  const found = await query
  if (found.length !== requested.length) {
    throw new GraphQLError('Invite link roles must be active roles in this group')
  }
  return found.map(Number)
}
