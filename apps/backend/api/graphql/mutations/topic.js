import { GraphQLError } from 'graphql'
import { EVENT_TYPES } from '../../../lib/analytics/trackActivity'
import { track } from '../../../lib/analytics/track'

export async function topicMutationPermissionCheck (userId, groupId) {
  const group = await Group.find(groupId)
  if (!group) {
    throw new GraphQLError('That group does not exist.')
  }
  if (!await GroupMembership.hasActiveMembership(userId, group)) {
    throw new GraphQLError("You're not a member of that group.")
  }
}

export async function createTopic (userId, topicName, groupId, isDefault, isSubscribing = true) {
  await topicMutationPermissionCheck(userId, groupId)
  const invalidReason = Tag.validate(topicName)
  if (invalidReason) {
    throw new GraphQLError(invalidReason)
  }

  const topic = await Tag.findOrCreate(topicName)
  await Tag.addToGroup({
    group_id: groupId,
    tag_id: topic.id,
    user_id: userId,
    is_default: isDefault,
    isSubscribing
  })
  track({
    type: EVENT_TYPES.TOPIC_CREATED,
    userId,
    groupIds: [groupId],
    object: { type: 'tag', id: topic.id }
  })
  return topic
}

export async function subscribe (userId, topicId, groupId, isSubscribing) {
  await topicMutationPermissionCheck(userId, groupId)
  await TagFollow.subscribe(topicId, userId, groupId, isSubscribing)
  return { success: true }
}
