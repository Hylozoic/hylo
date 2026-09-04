import { GraphQLError } from 'graphql'

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

export async function addGroupResponsibility ({ groupId, title, description, userId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')

  if (groupId && title) {
    await assertNotSpace(groupId)
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
    if (responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
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
      return roleResponsibility.destroy()
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to remove responsibility from role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to remove responsibility from role: received ${JSON.stringify({ roleResponsibilityId, groupId })}`)
  }
}
