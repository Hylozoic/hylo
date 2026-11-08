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

const RESERVED_TITLE_ERROR = 'A built-in responsibility already has this title'

/**
 * Find a role by id that belongs to this group, rejecting system (common) roles,
 * whose responsibilities cannot be edited.
 */
async function findEditableRoleInGroup (roleId, groupId) {
  const role = await GroupRole.where({ id: roleId, group_id: groupId }).fetch()
  if (!role) throw new GraphQLError('Role not found in this group')
  if (role.get('type') === GroupRole.TYPE_SYSTEM) {
    throw new GraphQLError('Common roles cannot have their responsibilities edited')
  }
  return role
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
        const groupResponsibility = await Responsibility.where({ id: responsibilityId, group_id: groupId }).fetch({ transacting })
        if (!groupResponsibility) throw new GraphQLError('Responsibility not found in this group')
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
      if (!groupRoleResponsibility) throw new GraphQLError('Responsibility not found in this group')
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
      await GroupRole.assertAssignableRoleIds([roleId])
      await findEditableRoleInGroup(roleId, groupId)
      // Only system responsibilities and this group's own responsibilities can be added
      const responsibility = await Responsibility.query(q => {
        q.where('id', responsibilityId)
          .andWhere(q2 => q2.whereNull('group_id').orWhere('group_id', groupId))
      }).fetch()
      if (!responsibility) throw new GraphQLError('Responsibility not available in this group')
      // Adding a responsibility the role already has is a no-op
      const existing = await GroupRoleResponsibility.where({ group_role_id: roleId, responsibility_id: responsibilityId }).fetch()
      if (existing) return existing
      return GroupRoleResponsibility.forge({ group_role_id: roleId, responsibility_id: responsibilityId }).save()
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
      // Only remove a role responsibility that belongs to a role of this group
      const roleResponsibility = await GroupRoleResponsibility.query(q => {
        return q.where('group_roles_responsibilities.id', roleResponsibilityId)
          .whereIn('group_roles_responsibilities.group_role_id', bookshelf.knex('groups_roles').select('id').where('group_id', groupId))
      })
        .fetch()
      if (!roleResponsibility) throw new GraphQLError('Role responsibility not found in this group')
      await GroupRole.assertAssignableRoleIds([roleResponsibility.get('group_role_id')])
      await findEditableRoleInGroup(roleResponsibility.get('group_role_id'), groupId)
      await roleResponsibility.destroy()
      return { success: true }
    } else {
      throw new GraphQLError('User doesn\'t have required privileges to remove responsibility from role')
    }
  } else {
    throw new GraphQLError(`Invalid/undefined parameters to remove responsibility from role: received ${JSON.stringify({ roleResponsibilityId, groupId })}`)
  }
}
