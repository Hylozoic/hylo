import { GraphQLError } from 'graphql'
import { assertKeepsAdministrator } from '../../models/group/administrators'
import expireForPolicyChange from '../../models/invitation/expireForPolicyChange'

/**
 * Reject responsibility mutations targeting a space — edit on the parent group instead.
 */
async function assertNotSpace (groupId) {
  if (!groupId) return
  const group = await Group.find(groupId)
  if (group && (group.get('type') === 'space' || group.get('parent_id'))) {
    throw new GraphQLError('Responsibilities cannot be edited on a space; edit them on the parent group instead')
  }
}

const RESERVED_TITLE_ERROR = 'A built-in responsibility already has this title'

export const MEMBER_ROLE_RESPONSIBILITY_ERROR = "The Member role can only take this group's own responsibilities"

/**
 * The implicit Member role this id names, as { id, group_id }, or null when it
 * names another role or is not written as plain digits.
 */
async function findMemberRole (roleId) {
  const id = GroupRole.parseRoleId(roleId)
  if (id == null) return null
  return bookshelf.knex('groups_roles').where({ id, type: GroupRole.TYPE_MEMBER }).first('id', 'group_id')
}

/**
 * The Member role takes only its own group's custom responsibilities, and never
 * one titled like a built-in responsibility, since permission checks match
 * titles. Every platform responsibility stays off it: Invite Members is set
 * only through "Who can add new members?".
 */
async function assertMemberRoleResponsibility (memberRole, responsibilityId, groupId) {
  if (String(memberRole.group_id) !== String(await Group.roleScopeId(groupId))) {
    throw new GraphQLError(GroupRole.MEMBER_ROLE_LOCKED_ERROR)
  }
  const id = GroupRole.parseRoleId(responsibilityId)
  const responsibility = id == null ? null : await bookshelf.knex('responsibilities').where({ id }).first('id', 'type', 'group_id', 'title')
  if (!responsibility ||
    responsibility.type === 'system' ||
    String(responsibility.group_id) !== String(memberRole.group_id) ||
    await Responsibility.isSystemTitle(responsibility.title)) {
    throw new GraphQLError(MEMBER_ROLE_RESPONSIBILITY_ERROR)
  }
}

export async function addGroupResponsibility ({ groupId, title, description, userId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (groupId && title) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      if (await Responsibility.isSystemTitle(title)) throw new GraphQLError(RESERVED_TITLE_ERROR)
      return Responsibility.forge({ group_id: groupId, title, description, type: 'group' }).save().then((savedGroupResponsibility) => savedGroupResponsibility)
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to create group responsibility')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to create group responsibility: received ${JSON.stringify({ groupId, title })}`)
  }
}

export async function updateGroupResponsibility ({ responsibilityId, title, description, userId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (responsibilityId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      return bookshelf.transaction(async transacting => {
        const groupResponsibility = await Responsibility.where({ id: responsibilityId }).fetch()
        const titleChanged = title && title.trim().toLowerCase() !== (groupResponsibility.get('title') || '').trim().toLowerCase()
        if (titleChanged && await Responsibility.isSystemTitle(title)) throw new GraphQLError(RESERVED_TITLE_ERROR)
        const updatedAttributes = {
          title: title || groupResponsibility.get('title'),
          description: description || groupResponsibility.get('description')
        }

        return groupResponsibility.save(updatedAttributes, { transacting }).then((savedGroupResponsibility) => savedGroupResponsibility)
      })
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to update a group responsibility')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to update group responsibility: received ${JSON.stringify({ groupId, title, responsibilityId })}`)
  }
}

export async function deleteGroupResponsibility ({ responsibilityId, userId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (responsibilityId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      const groupRoleResponsibility = await Responsibility.query(q => {
        return q.where('id', responsibilityId)
          .andWhere('group_id', groupId)
      })
        .fetch()
      return groupRoleResponsibility.destroy()
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to delete a group responsibility')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to delete group responsibility: received ${JSON.stringify({ groupId, responsibilityId })}`)
  }
}

export async function addResponsibilityToRole ({ userId, responsibilityId, roleId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (responsibilityId && roleId && groupId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      const memberRole = await findMemberRole(roleId)
      if (memberRole) {
        await assertMemberRoleResponsibility(memberRole, responsibilityId, groupId)
        return GroupRoleResponsibility.forge({ group_role_id: memberRole.id, responsibility_id: GroupRole.parseRoleId(responsibilityId) }).save()
      }
      await GroupRole.assertAssignableRoleIds([roleId])
      if (!GroupRole.memberInvitesEnabled()) {
        const inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS)
        const responsibility = await Responsibility.where({ id: responsibilityId }).fetch()
        if (inviteMembersId && responsibility && String(responsibility.id) === String(inviteMembersId)) {
          throw new GraphQLError(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
        }
      }
      return GroupRoleResponsibility.forge({ group_role_id: roleId, responsibility_id: responsibilityId }).save().then((savedRoleResponsibility) => savedRoleResponsibility)
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to add responsibility to role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to add responsibility to role: received ${JSON.stringify({ responsibilityId, roleId })}`)
  }
}

export async function removeResponsibilityFromRole ({ userId, roleResponsibilityId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (roleResponsibilityId && groupId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      const roleResponsibility = await GroupRoleResponsibility.query(q => {
        return q.where('id', roleResponsibilityId)
      })
        .fetch()
      const memberRole = roleResponsibility && await findMemberRole(roleResponsibility.get('group_role_id'))
      if (memberRole) {
        await assertMemberRoleResponsibility(memberRole, roleResponsibility.get('responsibility_id'), groupId)
        return roleResponsibility.destroy()
      }
      await GroupRole.assertAssignableRoleIds([roleResponsibility?.get('group_role_id')])
      const role = roleResponsibility && await GroupRole.where({ id: roleResponsibility.get('group_role_id') }).fetch()
      if (role) {
        await assertKeepsAdministrator(role.get('group_id'), { excludeRoleResponsibilityId: roleResponsibility.id })
      }
      const removedInviteMembers = String(roleResponsibility.get('responsibility_id')) ===
        String(await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS))
      const destroyed = await roleResponsibility.destroy()
      // People who could only invite through this role no longer vouch for their pending invitations
      if (role && removedInviteMembers) await expireForPolicyChange(role.get('group_id'))
      return destroyed
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to remove responsibility from role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to remove responsibility from role: received ${JSON.stringify({ roleResponsibilityId, groupId })}`)
  }
}
