import { GRANT_CONTENT_ACCESS } from 'store/constants'

/**
 * Grants content access to a user, or to all current members of a group (admin only).
 *
 * @param {Object} params
 * @param {string} [params.userId] - ID of the user to grant access to (required unless grantToAllMembers)
 * @param {string} params.grantedByGroupId - ID of the group granting access
 * @param {string} [params.groupId] - Target group or space id (spaces are child groups)
 * @param {string} [params.productId] - ID of the product/offering to grant access to
 * @param {string} [params.groupRoleId] - ID of the group role to grant
 * @param {string} [params.expiresAt] - When the access expires (ISO date string)
 * @param {string} [params.reason] - Reason for granting access
 * @param {boolean} [params.grantToAllMembers] - Grant to every current member of grantedByGroupId
 */
export default function grantContentAccess ({
  userId,
  grantedByGroupId,
  groupId,
  productId,
  groupRoleId,
  expiresAt,
  reason,
  grantToAllMembers = false
}) {
  return {
    type: GRANT_CONTENT_ACCESS,
    graphql: {
      query: `
        mutation GrantContentAccess(
          $userId: ID,
          $grantedByGroupId: ID!,
          $groupId: ID,
          $productId: ID,
          $groupRoleId: ID,
          $expiresAt: Date,
          $reason: String,
          $grantToAllMembers: Boolean
        ) {
          grantContentAccess(
            userId: $userId,
            grantedByGroupId: $grantedByGroupId,
            groupId: $groupId,
            productId: $productId,
            groupRoleId: $groupRoleId,
            expiresAt: $expiresAt,
            reason: $reason,
            grantToAllMembers: $grantToAllMembers
          ) {
            id
            userId
            grantedByGroupId
            groupId
            productId
            groupRoleId
            accessType
            status
            success
            message
            grantedCount
          }
        }
      `,
      variables: {
        userId: grantToAllMembers ? null : userId,
        grantedByGroupId,
        groupId: groupId || null,
        productId: productId || null,
        groupRoleId: groupRoleId || null,
        expiresAt: expiresAt || null,
        reason: reason || null,
        grantToAllMembers: !!grantToAllMembers
      }
    },
    meta: {
      extractModel: 'ContentAccess'
    }
  }
}
