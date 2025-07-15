/**
 * Utilities for publishing group subscription updates in a non-blocking way
 */

import RedisPubSub from '../api/services/RedisPubSub'

/**
 * Publishes group updates to all members of a group.
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {string|Object} group - Group ID or Group object with members
 * @param {Object} groupData - Group data to publish
 */
export async function publishGroupUpdate (context, group, groupData) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  try {
    // Handle both group ID and group object
    const groupObj = typeof group === 'string' ? await Group.find(group) : group
    if (!groupObj) return

    // Get all group members
    const members = await groupObj.members().fetch()

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Publishing group update: ${groupData.name || groupData.get?.('name') || groupObj.get('name')} (${groupData.id || groupData.get?.('id') || groupObj.id}) to ${members.length} members`)
    }

    // Publish to each member's user channel
    for (const member of members.models) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`   → Notifying member ${member.get('name')} (${member.id})`)
      }
      pubSub.publish(`groupUpdates:${member.id}`, { group: groupData })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Successfully published ${members.length} group update notifications`)
    }
  } catch (error) {
    console.error('❌ Error in publishGroupUpdate:', error)
  }
}

/**
 * Publishes group membership updates to all members of a group.
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {string|Object} group - Group ID or Group object with members
 * @param {Object} membershipData - Membership update data
 * @param {Object} options - Additional options
 */
export async function publishGroupMembershipUpdate (context, group, membershipData, options = {}) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  try {
    const { preloadedMembers, additionalUserIds = [] } = options

    // Handle both group ID and group object
    const groupObj = typeof group === 'string' ? await Group.find(group) : group
    if (!groupObj) return

    // Use preloaded members if provided, otherwise fetch them
    const members = preloadedMembers || (await groupObj.members().fetch())
    const memberCount = Array.isArray(members) ? members.length : members.models?.length || 0

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Publishing membership update: ${membershipData.member?.name || membershipData.member?.get?.('name')} ${membershipData.action} group ${membershipData.group?.name || membershipData.group?.get?.('name') || groupObj.get('name')} to ${memberCount} existing members`)
    }

    const membershipUpdate = {
      group: membershipData.group || groupObj,
      member: membershipData.member,
      action: membershipData.action,
      role: membershipData.role || null
    }

    // Publish to each member's user channel
    const membersList = Array.isArray(members) ? members : members.models
    for (const member of membersList) {
      const memberId = member.id || member.get('id')
      const memberName = member.name || member.get('name')
      if (process.env.NODE_ENV === 'development') {
        console.log(`   → Notifying member ${memberName} (${memberId})`)
      }
      pubSub.publish(`groupMembershipUpdates:${memberId}`, { groupMembershipUpdate: membershipUpdate })
    }

    // Also notify additional users (like the person who was added/removed)
    if (additionalUserIds.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`   → Also notifying ${additionalUserIds.length} additional users`)
      }
      for (const userId of additionalUserIds) {
        pubSub.publish(`groupMembershipUpdates:${userId}`, { groupMembershipUpdate: membershipUpdate })
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Successfully published ${memberCount + additionalUserIds.length} membership notifications`)
    }
  } catch (error) {
    console.error('❌ Error in publishGroupMembershipUpdate:', error)
  }
}

/**
 * Publishes group relationship updates to all members of both groups.
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {Object} relationshipData - Relationship update data
 * @param {string|Object} relationshipData.parentGroupId - Parent group ID or object
 * @param {string|Object} relationshipData.childGroupId - Child group ID or object
 * @param {string} relationshipData.action - Action performed
 * @param {Object} relationshipData.relationship - Relationship object (optional)
 */
export async function publishGroupRelationshipUpdate (context, relationshipData) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  try {
    const { parentGroupId, childGroupId, action, relationship } = relationshipData

    // Handle both group IDs and group objects
    const parentGroupObj = typeof parentGroupId === 'string' ? await Group.find(parentGroupId) : parentGroupId
    const childGroupObj = typeof childGroupId === 'string' ? await Group.find(childGroupId) : childGroupId

    if (!parentGroupObj || !childGroupObj) return

    // Get all members from both groups
    const parentMembers = await parentGroupObj.members().fetch()
    const childMembers = await childGroupObj.members().fetch()

    // Combine and deduplicate members
    const allMemberIds = new Set()
    const allMembers = []
    for (const member of parentMembers.models) {
      if (!allMemberIds.has(member.id)) {
        allMemberIds.add(member.id)
        allMembers.push(member)
      }
    }
    for (const member of childMembers.models) {
      if (!allMemberIds.has(member.id)) {
        allMemberIds.add(member.id)
        allMembers.push(member)
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Publishing relationship update: ${action} between ${parentGroupObj.get('name')} and ${childGroupObj.get('name')} to ${allMembers.length} combined members`)
    }

    const relationshipUpdate = {
      parentGroup: parentGroupObj,
      childGroup: childGroupObj,
      action,
      relationship
    }

    // Publish to each member's user channel
    for (const member of allMembers) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`   → Notifying member ${member.get('name')} (${member.id})`)
      }
      pubSub.publish(`groupRelationshipUpdates:${member.id}`, { groupRelationshipUpdate: relationshipUpdate })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Successfully published ${allMembers.length} relationship notifications`)
    }
  } catch (error) {
    console.error('❌ Error in publishGroupRelationshipUpdate:', error)
  }
}
