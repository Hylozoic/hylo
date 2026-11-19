import { FREE_UPLOAD_LIMIT_BYTES, uploadLimitFor } from '@hylo/shared'
import * as types from './types'

// The Hylo Pro feature that raises a group's upload limit (packages/shared HyloProFeatures.js)
export const LARGER_UPLOADS_FEATURE = 'largerUploads'

/**
 * Group ids from a request param: an array, a comma-separated string or a single id.
 */
export function parseGroupIds (groupIds) {
  if (!groupIds) return []
  const list = Array.isArray(groupIds) ? groupIds : String(groupIds).split(',')
  return [...new Set(list.map(id => String(id).trim()).filter(id => id && id !== 'new'))]
}

/**
 * The groups an upload is for, by upload type:
 * - an existing post (or a post completion): the post's groups
 * - a new post or a comment: the `groupIds` the client sent, kept only where the user is a member
 *   (so a client can't borrow another group's limit)
 * - group avatars, banners and welcome pages: the group itself
 * - funding round images: the round's group
 * - user avatars, banners and CSV imports: none
 */
export async function groupIdsForUpload ({ userId, type, id, groupIds }) {
  const isNew = !id || id === 'new'
  switch (type) {
    case types.POST:
    case types.POST_COMPLETION: {
      if (isNew) return memberGroupIds(userId, groupIds)
      const post = await Post.find(id, { withRelated: 'groups' })
      return post ? post.relations.groups.pluck('id').map(String) : []
    }
    case types.COMMENT:
      return memberGroupIds(userId, groupIds)
    case types.GROUP_AVATAR:
    case types.GROUP_BANNER:
    case types.WELCOME_PAGE:
      return isNew ? [] : [String(id)]
    case types.FUNDING_ROUND_DESCRIPTION:
    case types.FUNDING_ROUND_CRITERIA: {
      if (isNew) return []
      const round = await FundingRound.where({ id }).fetch({ require: false })
      return round && round.get('group_id') ? [String(round.get('group_id'))] : []
    }
    default:
      return []
  }
}

async function memberGroupIds (userId, groupIds) {
  const ids = parseGroupIds(groupIds)
  if (!userId || ids.length === 0) return []
  const memberships = await Promise.all(ids.map(id => GroupMembership.hasActiveMembership(userId, id)))
  return ids.filter((id, i) => memberships[i])
}

/**
 * The per-file byte limit for an upload: the Pro limit when every group the upload is for has the
 * largerUploads feature, otherwise the free limit (also for uploads that aren't for any group).
 */
export async function uploadLimitForRequest ({ userId, type, id, groupIds }) {
  const ids = await groupIdsForUpload({ userId, type, id, groupIds })
  if (ids.length === 0) return FREE_UPLOAD_LIMIT_BYTES
  const groups = await Group.where('id', 'in', ids).fetchAll()
  if (groups.length !== ids.length) return FREE_UPLOAD_LIMIT_BYTES
  const features = await Promise.all(groups.map(group => group.hasProFeature(LARGER_UPLOADS_FEATURE)))
  return uploadLimitFor({ largerUploads: features.every(Boolean) })
}
