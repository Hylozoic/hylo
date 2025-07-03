/**
 * Utilities for publishing group subscription updates in a non-blocking way
 */

import RedisPubSub from '../api/services/RedisPubSub'

/**
 * Publishes group updates to all members of a group
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {Object} group - Group object with members
 * @param {Object} groupData - Group data to publish
 */
export async function publishGroupUpdate (context, group, groupData) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  // Get all group members
  const members = await group.members().fetch()
  if (process.env.NODE_ENV === 'development') {
    console.log(`📡 Publishing group update: ${groupData.name || groupData.get?.('name') || group.get('name')} (${groupData.id || groupData.get?.('id') || group.id}) to ${members.length} members`)
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
}

/**
 * Publishes membership updates to all group members
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {Object} group - Group object with members
 * @param {Object} membershipData - Membership update data
 * @param {Object} options - Additional options
 */
export async function publishGroupMembershipUpdate (context, group, membershipData, options = {}) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  const { preloadedMembers, additionalUserIds = [] } = options

  // Use preloaded members if provided, otherwise fetch them
  const members = preloadedMembers || (await group.members().fetch())
  const memberCount = Array.isArray(members) ? members.length : members.models?.length || 0

  if (process.env.NODE_ENV === 'development') {
    console.log(`📡 Publishing membership update: ${membershipData.member?.name || membershipData.member?.get?.('name')} ${membershipData.action} group ${membershipData.group?.name || membershipData.group?.get?.('name')} to ${memberCount} existing members`)
  }

  const membershipUpdate = {
    group: membershipData.group,
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
}

/**
 * Publishes relationship updates to all members of both groups
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {Object} relationshipData - Relationship update data
 */
export async function publishGroupRelationshipUpdate (context, relationshipData) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  const { parentGroup, childGroup, action, relationship } = relationshipData

  // Get all members from both groups
  const parentMembers = await parentGroup.members().fetch()
  const childMembers = await childGroup.members().fetch()

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
    console.log(`📡 Publishing relationship update: ${action} between ${parentGroup.get('name')} and ${childGroup.get('name')} to ${allMembers.length} combined members`)
  }

  const relationshipUpdate = {
    parentGroup,
    childGroup,
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
}

/**
 * Non-blocking wrapper that schedules publishing for next tick
 * @param {Function} publishFunction - The publishing function to call
 * @param {...any} args - Arguments to pass to the publishing function
 */
export function publishAsync (publishFunction, ...args) {
  setImmediate(async () => {
    try {
      await publishFunction(...args)
    } catch (error) {
      console.error('❌ Error in background publishing:', error)
    }
  })
}

module.exports = {
  publishGroupUpdate,
  publishGroupMembershipUpdate,
  publishGroupRelationshipUpdate,
  publishAsync
}
