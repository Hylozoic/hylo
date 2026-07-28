import { GraphQLError } from 'graphql'

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
      return bookshelf.transaction(async transacting => {
        const groupRole = await GroupRole.where({ id: groupRoleId }).fetch()
        const verifiedActiveParam = (active == null) ? groupRole.get('active') : active
        const updatedAttributes = {
          color: color || groupRole.get('color'),
          name: name || groupRole.get('name'),
          description: description || groupRole.get('description'),
          emoji: emoji || groupRole.get('emoji'),
          active: verifiedActiveParam
        }

        return groupRole.save(updatedAttributes, { transacting }).then((savedGroupRole) => savedGroupRole)
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
      const role = await MemberGroupRole.query(q => {
        return q.where('user_id', personId)
          .andWhere('group_role_id', roleId)
          .andWhere('group_id', groupId)
      }).fetch()
      return role.destroy()
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to remove role from member')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to remove role from member: received ${JSON.stringify({ personId, roleId, groupId })}`)
  }
}
