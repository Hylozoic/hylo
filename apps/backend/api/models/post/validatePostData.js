import { GraphQLError } from 'graphql'
import { includes, isEmpty, sortBy, uniq } from 'lodash'
import { POST_TYPE_TO_TYPED_VIEW } from '@hylo/shared'

/** Steward-configured types that `accepted_post_types` can restrict. Chat/action/submission are not in this set. */
const RESTRICTED_POST_TYPES = Object.keys(POST_TYPE_TO_TYPED_VIEW)

/**
 * Parses a group's `accepted_post_types` jsonb value to an array or null.
 * @param {*} value - Raw column value
 * @returns {string[]|null}
 */
export function parseAcceptedPostTypes (value) {
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
 * Label for a destination in error messages: a space is shown under its parent
 * group ("Parent Group / Space"), a top-level group by its own name.
 * @param {Group} group
 * @param {Object<string, string>} parentNames - Parent group names keyed by id
 * @returns {string}
 */
export function destinationLabel (group, parentNames = {}) {
  const parentName = group.get('type') === 'space' && parentNames[String(group.get('parent_id'))]
  return parentName ? `${parentName} / ${group.get('name')}` : group.get('name')
}

/**
 * Joins labels as "A", "A and B" or "A, B and C".
 * @param {string[]} labels
 * @returns {string}
 */
function joinLabels (labels) {
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** GraphQL error code for a post type that a destination refuses (see assertGroupsAcceptPostType). */
export const POST_TYPE_NOT_ACCEPTED = 'POST_TYPE_NOT_ACCEPTED'

/**
 * Rejects when any destination group does not accept the post type. Names only the
 * groups/spaces that refuse it, with spaces labelled "Parent Group / Space" (a space
 * has a single parent, groups.parent_id).
 *
 * The data is in the error's `extensions` ({ code: POST_TYPE_NOT_ACCEPTED, postType,
 * destinations: [labels] }) so clients can build the sentence in the user's language;
 * the English `message` is a fallback for clients that don't know the code.
 * @param {Array<string|number>} groupIds - Destination group ids
 * @param {string} postType - Post type being created
 * @returns {Promise<void>}
 */
export async function assertGroupsAcceptPostType (groupIds, postType) {
  if (!postType || !RESTRICTED_POST_TYPES.includes(postType)) return
  if (isEmpty(groupIds)) return

  const groups = await Group.query(q => q.whereIn('id', groupIds)).fetchAll()
  // Keep the order the destinations were given in (the To field's order)
  const position = id => groupIds.findIndex(gid => String(gid) === String(id))
  const blockers = sortBy(groups.models, g => position(g.id))
    .filter(group => !groupAcceptsPostType(group.get('accepted_post_types'), postType))
  if (blockers.length === 0) return

  const parentIds = uniq(blockers.filter(g => g.get('type') === 'space' && g.get('parent_id')).map(g => g.get('parent_id')))
  const parentNames = {}
  if (parentIds.length > 0) {
    const parents = await Group.query(q => q.whereIn('id', parentIds)).fetchAll()
    parents.models.forEach(parent => { parentNames[String(parent.id)] = parent.get('name') })
  }

  const labels = blockers.map(group => destinationLabel(group, parentNames))
  const verb = labels.length === 1 ? 'does' : 'do'
  throw new GraphQLError(`${joinLabels(labels)} ${verb} not accept ${postType} posts`, {
    extensions: { code: POST_TYPE_NOT_ACCEPTED, postType, destinations: labels }
  })
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
