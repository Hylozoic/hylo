import { GraphQLError } from 'graphql'
import { includes, isEmpty } from 'lodash'
import { POST_TYPE_TO_TYPED_VIEW } from '@hylo/shared'

/** Steward-configured types that `accepted_post_types` can restrict. Chat/action/submission are not in this set. */
const RESTRICTED_POST_TYPES = Object.keys(POST_TYPE_TO_TYPED_VIEW)

/**
 * Parses a group's `accepted_post_types` jsonb value to an array or null.
 * @param {*} value - Raw column value
 * @returns {string[]|null}
 */
function parseAcceptedPostTypes (value) {
  if (value == null) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * Whether a group's accepted_post_types allow this post type.
 * null = all types. [] = none of the restricted types.
 * Types outside the steward-configured set (chat, action, submission) are always allowed.
 * @param {*} acceptedPostTypes - Group's accepted_post_types value
 * @param {string} postType - Post type being created
 * @returns {boolean}
 */
export function groupAcceptsPostType (acceptedPostTypes, postType) {
  if (!postType || !RESTRICTED_POST_TYPES.includes(postType)) return true
  const types = parseAcceptedPostTypes(acceptedPostTypes)
  if (types == null) return true
  if (types.length === 0) return false
  if (types.includes(postType)) return true
  // PostTypePills key stored as a single alias for request + offer
  if ((postType === Post.Type.REQUEST || postType === Post.Type.OFFER) &&
      types.includes('requests-and-offers')) return true
  return false
}

/**
 * Rejects when any destination group does not accept the post type.
 * @param {Array<string|number>} groupIds - Destination group ids
 * @param {string} postType - Post type being created
 * @returns {Promise<void>}
 */
export async function assertGroupsAcceptPostType (groupIds, postType) {
  if (!postType || !RESTRICTED_POST_TYPES.includes(postType)) return
  if (isEmpty(groupIds)) return

  const groups = await Group.query(q => q.whereIn('id', groupIds)).fetchAll()
  for (const group of groups.models) {
    if (!groupAcceptsPostType(group.get('accepted_post_types'), postType)) {
      throw new GraphQLError(`${group.get('name')} does not accept ${postType} posts`)
    }
  }
}

export default function validatePostData (userId, data) {
  const allowedTypes = [Post.Type.ACTION, Post.Type.CHAT, Post.Type.REQUEST, Post.Type.OFFER, Post.Type.DISCUSSION, Post.Type.PROJECT, Post.Type.EVENT, Post.Type.RESOURCE, Post.Type.PROPOSAL, Post.Type.SUBMISSION]
  if (data.type && !includes(allowedTypes, data.type)) {
    throw new GraphQLError('not a valid type')
  }

  if (data.type === Post.Type.PROPOSAL && data.proposalOptions && data.proposalOptions.length === 0) {
    throw new GraphQLError('Proposals need at a least one option')
  }

  if (isEmpty(data.group_ids)) {
    throw new GraphQLError('no groups specified')
  }

  if (data.topicNames && data.topicNames.length > 3) {
    throw new GraphQLError('too many topics in post, maximum 3')
  }

  return Group.allHaveMember(data.group_ids, userId)
    .then(ok => ok ? Promise.resolve() : Promise.reject(new GraphQLError('unable to post to all those groups')))
}
