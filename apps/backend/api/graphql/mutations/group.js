import { GraphQLError } from 'graphql'
import GroupService from '../../services/GroupService'
import convertGraphqlData from './convertGraphqlData'
import underlyingDeleteGroupTopic from '../../models/group/deleteGroupTopic'
import {
  publishGroupUpdate,
  publishGroupMembershipUpdate,
  publishGroupRelationshipUpdate
} from '../../../lib/groupSubscriptionPublisher'
import { publishAsync } from '../../../lib/subscriptionUtils'

// Util function
async function getStewardedGroup (userId, groupId, additionalResponsibility = '', opts = {}) {
  const group = await Group.find(groupId, opts)
  if (!group) {
    throw new GraphQLError('Group not found')
  }

  const isSteward = await GroupMembership.hasResponsibility(userId, group, additionalResponsibility, opts)
  if (!isSteward) {
    throw new GraphQLError("You don't have the right responsibilities for this group")
  }

  return group
}

// Group Mutations

export async function addModerator (userId, personId, groupId, context) {
  const group = await getStewardedGroup(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
  const person = await User.find(personId)
  await GroupMembership.setModeratorRole(personId, group)

  // Publish group membership update to all group members (non-blocking)
  publishAsync(publishGroupMembershipUpdate, context, groupId, {
    group,
    member: person,
    action: 'moderator_added'
  })

  return group
}

export async function createGroup (userId, data) {
  return Group.create(userId, convertGraphqlData(data))
}

export async function deleteGroup (userId, groupId) {
  await getStewardedGroup(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)

  await Group.deactivate(groupId)
  return { success: true }
}

export async function deleteGroupTopic (userId, groupTopicId) {
  const groupTopic = await GroupTag.where({ id: groupTopicId }).fetch()

  await getStewardedGroup(userId, groupTopic.get('group_id'), Responsibility.constants.RESP_MANAGE_CONTENT)

  await underlyingDeleteGroupTopic(groupTopic)
  return { success: true }
}

export async function deleteGroupRelationship (userId, parentId, childId, context) {
  const groupRelationship = await GroupRelationship.forPair(parentId, childId).fetch()
  if (!groupRelationship) {
    return { success: true }
  }
  let childGroup, parentGroup
  try {
    childGroup = await getStewardedGroup(userId, groupRelationship.get('child_group_id'), Responsibility.constants.RESP_ADMINISTRATION)
  } catch (e) {}
  try {
    parentGroup = await getStewardedGroup(userId, groupRelationship.get('parent_group_id'), Responsibility.constants.RESP_ADMINISTRATION)
  } catch (e) {}

  if (childGroup || parentGroup) {
    // the logged in user is a steward of one of the groups and so can delete the relationship
    await groupRelationship.save({ active: false })

    // Publish group relationship updates to all members of both groups (non-blocking)
    publishAsync(publishGroupRelationshipUpdate, context, {
      parentGroupId: parentId,
      childGroupId: childId,
      action: 'relationship_removed',
      relationship: null
    })

    return { success: true }
  }
  throw new GraphQLError("You don't have permission to do this")
}

// Called when a user joins an open group
export async function joinGroup (groupId, userId, questionAnswers, context) {
  const user = await User.find(userId)
  if (!user) throw new GraphQLError(`User id ${userId} not found`)
  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError(`Group id ${groupId} not found`)
  // TODO: what about hidden groups? can you join them? for now we are going with yes if not closed
  if (group.get('accessibility') !== Group.Accessibility.OPEN) {
    throw new GraphQLError('You do not have permisson to do that')
  }
  // Make sure user is first a member of all prerequisite groups
  const prerequisiteGroups = await group.prerequisiteGroups().fetch()
  await Promise.map(prerequisiteGroups.models, async (prereq) => {
    const isMemberOfPrereq = await GroupMembership.forPair(userId, prereq.id).fetch()
    if (!isMemberOfPrereq) {
      throw new GraphQLError(`You must be a member of group ${prereq.get('name')} first`)
    }
  })

  const result = await user.joinGroup(group, { questionAnswers })

  // Subscription publishing for group joins is handled in the background job Group.afterAddMembers

  return result
}

export async function regenerateAccessCode (userId, groupId) {
  const group = await getStewardedGroup(userId, groupId, Responsibility.constants.RESP_ADD_MEMBERS)
  const code = await Group.getNewAccessCode()
  return group.save({ access_code: code }, { patch: true }) // eslint-disable-line camelcase
}

/**
 * As a host, removes member from a group.
 */
export async function removeMember (loggedInUserId, userIdToRemove, groupId, context) {
  const group = await getStewardedGroup(loggedInUserId, groupId, Responsibility.constants.RESP_REMOVE_MEMBERS)
  const memberToRemove = await User.find(userIdToRemove)

  await GroupService.removeMember(userIdToRemove, groupId)

  publishAsync(publishGroupMembershipUpdate, context, groupId, {
    group,
    member: memberToRemove,
    action: 'left'
  }, {
    additionalUserIds: [userIdToRemove]
  })

  return group
}

export async function removeModerator (userId, personId, groupId, isRemoveFromGroup, context) {
  const group = await getStewardedGroup(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
  const person = await User.find(personId)

  if (isRemoveFromGroup) {
    await GroupMembership.removeModeratorRole(personId, group)
    await GroupService.removeMember(personId, groupId)

    publishAsync(publishGroupMembershipUpdate, context, groupId, {
      group,
      member: person,
      action: 'left'
    }, {
      additionalUserIds: [personId]
    })
  } else {
    await GroupMembership.removeModeratorRole(personId, group)

    publishAsync(publishGroupMembershipUpdate, context, groupId, {
      group,
      member: person,
      action: 'moderator_removed'
    })
  }

  return group
}

export async function updateGroup (userId, groupId, changes, context) {
  const group = await getStewardedGroup(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)

  const updatedGroup = await group.update(convertGraphqlData(changes), userId)

  publishAsync(publishGroupUpdate, context, groupId, updatedGroup)

  return updatedGroup
}

// Group to group relationship mutations
export async function inviteGroupToGroup (userId, fromId, toId, type, questionAnswers = [], opts = {}) {
  const toGroup = await Group.find(toId, opts)
  if (!toGroup) {
    throw new GraphQLError('Group not found')
  }

  if (!Object.values(GroupRelationshipInvite.TYPE).includes(type)) {
    throw new GraphQLError('Invalid group relationship type')
  }

  const fromGroup = await getStewardedGroup(userId, fromId, Responsibility.constants.RESP_ADMINISTRATION, opts)

  if (await GroupRelationship.forPair(fromGroup, toGroup).fetch(opts)) {
    throw new GraphQLError('Groups are already related')
  }

  // If current user is an administrator of both the from group and the to group they can automatically join the groups together
  if (await GroupMembership.hasResponsibility(userId, toGroup, Responsibility.constants.RESP_ADMINISTRATION, opts)) {
    if (type === GroupRelationshipInvite.TYPE.ParentToChild) {
      return { success: true, groupRelationship: await fromGroup.addChild(toGroup, opts) }
    } if (type === GroupRelationshipInvite.TYPE.ChildToParent) {
      return { success: true, groupRelationship: await fromGroup.addParent(toGroup, opts) }
    }
  } else {
    const existingInvite = GroupRelationshipInvite.forPair(fromGroup, toGroup).fetch(opts)

    if (existingInvite && existingInvite.status === GroupRelationshipInvite.STATUS.Pending) {
      return { success: false, groupRelationshipInvite: existingInvite }
    }

    // If there's an existing processed invite then let's leave it and create a new one
    // TODO: what if the last one was rejected, do we let them create a new one?
    const invite = await GroupRelationshipInvite.create({
      userId,
      fromGroupId: fromId,
      toGroupId: toId,
      type
    }, opts)

    for (const qa of questionAnswers) {
      await GroupToGroupJoinRequestQuestionAnswer.forge({ join_request_id: invite.id, question_id: qa.questionId, answer: qa.answer }).save({}, opts)
    }
    return { success: true, groupRelationshipInvite: invite }
  }
}

export async function acceptGroupRelationshipInvite (userId, groupRelationshipInviteId, context) {
  const invite = await GroupRelationshipInvite.where({ id: groupRelationshipInviteId }).fetch()
  if (invite) {
    if (GroupMembership.hasResponsibility(userId, invite.get('to_group_id'), Responsibility.constants.RESP_ADMINISTRATION)) {
      const groupRelationship = await invite.accept(userId)
      const groupIds = [invite.get('from_group_id'), invite.get('to_group_id')]
      await Queue.classMethod('Group', 'doesMenuUpdate', { groupRelationship: true, groupIds })

      if (groupRelationship) {
        publishAsync(publishGroupRelationshipUpdate, context, {
          parentGroupId: invite.get('type') === GroupRelationshipInvite.TYPE.ParentToChild ? invite.get('from_group_id') : invite.get('to_group_id'),
          childGroupId: invite.get('type') === GroupRelationshipInvite.TYPE.ParentToChild ? invite.get('to_group_id') : invite.get('from_group_id'),
          action: 'invite_accepted',
          relationship: groupRelationship
        })
      }

      return { success: !!groupRelationship, groupRelationship }
    } else {
      throw new GraphQLError('You do not have permission to do this')
    }
  } else {
    throw new GraphQLError('Invalid parameters to accept invite')
  }
}

export async function cancelGroupRelationshipInvite (userId, groupRelationshipInviteId) {
  const invite = await GroupRelationshipInvite.where({ id: groupRelationshipInviteId }).fetch()
  if (invite) {
    if (GroupMembership.hasResponsibility(userId, invite.get('from_group_id'), Responsibility.constants.RESP_ADMINISTRATION)) {
      return { success: await invite.cancel(userId) }
    } else {
      throw new GraphQLError('You do not have permission to do this')
    }
  } else {
    throw new GraphQLError('Invalid parameters to cancel invite')
  }
}

export async function rejectGroupRelationshipInvite (userId, groupRelationshipInviteId) {
  const invite = await GroupRelationshipInvite.where({ id: groupRelationshipInviteId }).fetch()
  if (invite) {
    if (GroupMembership.hasResponsibility(userId, invite.get('to_group_id'), Responsibility.constants.RESP_ADMINISTRATION)) {
      return { success: await invite.reject(userId) }
    } else {
      throw new GraphQLError('You do not have permission to do this')
    }
  } else {
    throw new GraphQLError('Invalid parameters to reject invite')
  }
}

// API only Group Mutations
export async function addMember (userId, groupId, role) {
  const group = await Group.find(groupId)
  if (!group) {
    return { success: false, error: 'Group not found' }
  }

  if (group) {
    await group.addMembers([userId], { role: role || GroupMembership.Role.DEFAULT }, {})
  }
  return { success: true }
}

export async function invitePeerRelationship (userId, fromGroupId, toGroupId, description = null, opts = {}) {
  if (fromGroupId === toGroupId) {
    throw new GraphQLError('Cannot create peer relationship between the same group')
  }

  const fromGroup = await getStewardedGroup(userId, fromGroupId, Responsibility.constants.RESP_ADMINISTRATION, opts)
  const toGroup = await Group.find(toGroupId, opts)

  if (!toGroup) {
    throw new GraphQLError('Target group not found')
  }

  let relationship

  // Look for existing parent-child or peer to peer
  relationship = await GroupRelationship.forPair(fromGroup, toGroup, false).fetch(opts)
  if (!relationship) {
    // Look for existing child to parent
    relationship = await GroupRelationship.forPair(toGroup, fromGroup, false).fetch(opts)
  }

  if (relationship && relationship.get('active')) {
    throw new GraphQLError('Group relationship already exists')
  }

  // Check if current user is an administrator of both groups
  const isAdminOfToGroup = await GroupMembership.hasResponsibility(userId, toGroup, Responsibility.constants.RESP_ADMINISTRATION, opts)

  if (isAdminOfToGroup) {
    if (relationship) {
      // If relationship already exists (any type) and is not active, make it active and set to be peer to peer
      relationship.save({ parent_group_id: fromGroup, child_group_id: toGroup, active: true }, opts)
    } else {
      relationship = await GroupRelationship.forge({
        parent_group_id: fromGroup.id,
        child_group_id: toGroup.id,
        relationship_type: Group.RelationshipType.PEER_TO_PEER,
        description,
        active: true
      }).save(null, opts)
    }

    await publishAsync({
      type: 'groupRelationshipUpdate',
      data: {
        action: 'peer_relationship_created',
        parentGroup: fromGroup,
        childGroup: toGroup,
        relationship
      }
    })

    return { success: true, groupRelationship: relationship }
  } else {
    // Create an invitation
    const existingInvite = await GroupRelationshipInvite.forPair(fromGroup, toGroup).fetch(opts)

    if (existingInvite && existingInvite.get('status') === GroupRelationshipInvite.STATUS.Pending) {
      return { success: false, groupRelationshipInvite: existingInvite }
    }

    const invite = await GroupRelationshipInvite.create({
      userId,
      fromGroupId,
      toGroupId,
      type: GroupRelationshipInvite.TYPE.PeerToPeer,
      message: description
    }, opts)

    return { success: true, groupRelationshipInvite: invite }
  }
}

export async function updatePeerRelationship (userId, relationshipId, description, opts = {}) {
  console.log('🔄 updatePeerRelationship called:', { userId, relationshipId, description })
  const relationship = await GroupRelationship.where({ id: relationshipId, active: true }).fetch(opts)
  if (!relationship) {
    throw new GraphQLError('Relationship not found')
  }

  if (relationship.get('relationship_type') !== Group.RelationshipType.PEER_TO_PEER) {
    throw new GraphQLError('Can only update peer-to-peer relationships')
  }

  // Check that user is an admin of one of the groups
  const parentGroupId = relationship.get('parent_group_id')
  const childGroupId = relationship.get('child_group_id')

  const hasPermissionA = await GroupMembership.hasResponsibility(userId, parentGroupId, Responsibility.constants.RESP_ADMINISTRATION, opts)
  const hasPermissionB = await GroupMembership.hasResponsibility(userId, childGroupId, Responsibility.constants.RESP_ADMINISTRATION, opts)

  if (!hasPermissionA && !hasPermissionB) {
    throw new GraphQLError('You must be an administrator of one of the groups to update this relationship')
  }

  // Update both directions of the peer relationship
  await relationship.save({ description }, opts)

  // Find and update the reciprocal relationship
  const reciprocalRelationship = await GroupRelationship.where({
    parent_group_id: childGroupId,
    child_group_id: parentGroupId,
    relationship_type: Group.RelationshipType.PEER_TO_PEER,
    active: true
  }).fetch(opts)

  if (reciprocalRelationship) {
    await reciprocalRelationship.save({ description }, opts)
  }

  return relationship
}

export async function deletePeerRelationship (userId, relationshipId, opts = {}) {
  console.log('🔄 deletePeerRelationship called:', { userId, relationshipId })
  const relationship = await GroupRelationship.where({ id: relationshipId, active: true }).fetch(opts)
  if (!relationship) {
    throw new GraphQLError('Relationship not found')
  }

  if (relationship.get('relationship_type') !== Group.RelationshipType.PEER_TO_PEER) {
    throw new GraphQLError('Can only delete peer-to-peer relationships')
  }

  // Check that user is an admin of one of the groups
  const parentGroupId = relationship.get('parent_group_id')
  const childGroupId = relationship.get('child_group_id')

  const hasPermissionA = await GroupMembership.hasResponsibility(userId, parentGroupId, Responsibility.constants.RESP_ADMINISTRATION, opts)
  const hasPermissionB = await GroupMembership.hasResponsibility(userId, childGroupId, Responsibility.constants.RESP_ADMINISTRATION, opts)

  if (!hasPermissionA && !hasPermissionB) {
    throw new GraphQLError('You must be an administrator of one of the groups to delete this relationship')
  }

  // Delete the peer relationship
  await relationship.save({ active: false }, opts)

  // Publish relationship update
  await publishAsync({
    type: 'groupRelationshipUpdate',
    data: {
      action: 'peer_relationship_removed',
      parentGroup: { id: parentGroupId },
      childGroup: { id: childGroupId },
      relationship
    }
  })

  return { success: true }
}
