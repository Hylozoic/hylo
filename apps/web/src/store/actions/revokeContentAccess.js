import { REVOKE_CONTENT_ACCESS } from 'store/constants'

/**
 * Revokes content access for a user (admin only).
 * This will cancel any associated Stripe subscription.
 *
 * @param {Object} params
 * @param {string} params.accessId - ID of the content access record to revoke
 * @param {string} [params.reason] - Reason for revoking access
 */
export default function revokeContentAccess ({ accessId, reason }) {
  return {
    type: REVOKE_CONTENT_ACCESS,
    graphql: {
      query: `
        mutation RevokeContentAccess($accessId: ID!, $reason: String) {
          revokeContentAccess(accessId: $accessId, reason: $reason) {
            id
            status
            accessType
            metadata
          }
        }
      `,
      variables: {
        accessId,
        reason: reason || null
      }
    },
    meta: {
      accessId
    }
  }
}

