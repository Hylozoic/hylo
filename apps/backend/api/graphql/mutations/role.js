import { GraphQLError } from 'graphql'
import { assertKeepsAdministrator } from '../../models/group/administrators'
import expireForPolicyChange from '../../models/invitation/expireForPolicyChange'

/**
 * Reject role mutations targeting a space — roles are only edited on the parent group.
 */
async function assertNotSpace (groupId) {
  if (!groupId) return
  const group = await Group.find(groupId)
  if (group && (group.get('type') === 'space' || group.get('parent_id'))) {
    throw new GraphQLError('Roles cannot be edited on a space; edit roles on the parent group instead')
  }
}

export async function addGroupRole ({ groupId, color, name, description, emoji, userId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (groupId && name && emoji) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)

    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      return GroupRole.forge({ group_id: groupId, name, description, emoji, active: true, color, type: GroupRole.TYPE_CUSTOM }).save().then((savedGroupRole) => savedGroupRole)
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to create group role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to create group role: received ${JSON.stringify({ groupId, name, emoji })}`)
  }
}

export async function updateGroupRole ({ groupRoleId, color, name, description, emoji, userId, active, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (groupRoleId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      await GroupRole.assertAssignableRoleIds([groupRoleId])
      return bookshelf.transaction(async transacting => {
        const groupRole = await GroupRole.where({ id: groupRoleId }).fetch({ transacting })
        if (!groupRole) throw new GraphQLError('Role not found')
        if (groupRole.get('type') === GroupRole.TYPE_MEMBER) throw new GraphQLError(GroupRole.MEMBER_ROLE_LOCKED_ERROR)
        const verifiedActiveParam = (active == null) ? groupRole.get('active') : active
        if (verifiedActiveParam === false && groupRole.get('active')) {
          await assertKeepsAdministrator(groupRole.get('group_id'), { excludeRoleId: groupRole.id, transacting })
        }
        const updatedAttributes = {
          color: color || groupRole.get('color'),
          name: name || groupRole.get('name'),
          description: description || groupRole.get('description'),
          emoji: emoji || groupRole.get('emoji'),
          active: verifiedActiveParam
        }

        const wasActive = groupRole.get('active')
        const savedGroupRole = await groupRole.save(updatedAttributes, { transacting })
        // People who could only invite through this role no longer vouch for their pending invitations
        if (wasActive && verifiedActiveParam === false) {
          await expireForPolicyChange(groupRole.get('group_id'), { transacting })
        }
        return savedGroupRole
      })
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to update a group role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to update group role: received ${JSON.stringify({ groupId, name, emoji, groupRoleId, active })}`)
  }
}

export async function addRoleToMember ({ userId, roleId, personId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (personId && roleId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
      await GroupRole.assertAssignableRoleIds([roleId])
      return MemberGroupRole.forge({
        group_role_id: roleId,
        user_id: personId,
        active: true,
        group_id: groupId
      }).save().then((savedRole) => savedRole)
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to add role to member')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to add role to member: received ${JSON.stringify({ personId, roleId })}`)
  }
}

export async function removeRoleFromMember ({ userId, roleId, personId, groupId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (personId && roleId && groupId) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION) || userId === personId) {
      await GroupRole.assertAssignableRoleIds([roleId])
      const role = await MemberGroupRole.query(q => {
        return q.where('user_id', personId)
          .andWhere('group_role_id', roleId)
          .andWhere('group_id', groupId)
      }).fetch()
      if (role) {
        await assertKeepsAdministrator(groupId, { excludeAssignment: { userId: personId, roleId: role.get('group_role_id') } })
      }
      return role.destroy()
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to remove role from member')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to remove role from member: received ${JSON.stringify({ personId, roleId, groupId })}`)
  }
}
