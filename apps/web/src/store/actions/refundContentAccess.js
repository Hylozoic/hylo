import { REFUND_CONTENT_ACCESS } from 'store/constants'

/**
 * Refunds content access for a user (admin only).
 * This will revoke access, cancel any associated Stripe subscription,
 * and issue a refund for the most recent payment.
 *
 * @param {Object} params
 * @param {string} params.accessId - ID of the content access record to refund
 * @param {string} [params.reason] - Reason for refunding access
 */
export default function refundContentAccess ({ accessId, reason }) {
  return {
    type: REFUND_CONTENT_ACCESS,
    graphql: {
      query: `
        mutation RefundContentAccess($accessId: ID!, $reason: String) {
          refundContentAccess(accessId: $accessId, reason: $reason) {
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
