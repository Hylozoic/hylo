import { GRANT_CONTENT_ACCESS } from 'store/constants'

/**
 * Grants content access to a user (admin only).
 *
 * @param {Object} params
 * @param {string} params.userId - ID of the user to grant access to
 * @param {string} params.grantedByGroupId - ID of the group granting access
 * @param {string} [params.groupId] - ID of the group to grant access to
 * @param {string} [params.productId] - ID of the product/offering to grant access to
 * @param {string} [params.trackId] - ID of the track to grant access to
 * @param {string} [params.roleId] - ID of the role to grant
 * @param {string} [params.expiresAt] - When the access expires (ISO date string)
 * @param {string} [params.reason] - Reason for granting access
 */
export default function grantContentAccess ({
  userId,
  grantedByGroupId,
  groupId,
  productId,
  trackId,
  roleId,
  expiresAt,
  reason
}) {
  return {
    type: GRANT_CONTENT_ACCESS,
    graphql: {
      query: `
        mutation GrantContentAccess(
          $userId: ID!,
          $grantedByGroupId: ID!,
          $groupId: ID,
          $productId: ID,
          $trackId: ID,
          $roleId: ID,
          $expiresAt: Date,
          $reason: String
        ) {
          grantContentAccess(
            userId: $userId,
            grantedByGroupId: $grantedByGroupId,
            groupId: $groupId,
            productId: $productId,
            trackId: $trackId,
            roleId: $roleId,
            expiresAt: $expiresAt,
            reason: $reason
          ) {
            id
            userId
            grantedByGroupId
            groupId
            productId
            trackId
            roleId
            accessType
            status
            success
            message
          }
        }
      `,
      variables: {
        userId,
        grantedByGroupId,
        groupId: groupId || null,
        productId: productId || null,
        trackId: trackId || null,
        roleId: roleId || null,
        expiresAt: expiresAt || null,
        reason: reason || null
      }
    },
    meta: {
      extractModel: 'ContentAccess'
    }
  }
}
