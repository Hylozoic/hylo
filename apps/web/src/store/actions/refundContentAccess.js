import { REFUND_CONTENT_ACCESS } from 'store/constants'

/**
 * Refunds the most recent payment for a content access record (admin only).
 * A refund does not change access. When cancelFuturePayments is true and the
 * purchase is a subscription, it is cancelled at the end of the paid period.
 *
 * @param {Object} params
 * @param {string} params.accessId - ID of the content access record to refund
 * @param {string} [params.reason] - Reason for the refund
 * @param {boolean} [params.cancelFuturePayments] - Also cancel the subscription at period end
 */
export default function refundContentAccess ({ accessId, reason, cancelFuturePayments = false }) {
  return {
    type: REFUND_CONTENT_ACCESS,
    graphql: {
      query: `
        mutation RefundContentAccess($accessId: ID!, $reason: String, $cancelFuturePayments: Boolean) {
          refundContentAccess(accessId: $accessId, reason: $reason, cancelFuturePayments: $cancelFuturePayments) {
            id
            status
            accessType
            metadata
            refundedAt
            refundedAmount
          }
        }
      `,
      variables: {
        accessId,
        reason: reason || null,
        cancelFuturePayments: !!cancelFuturePayments
      }
    },
    meta: {
      accessId
    }
  }
}
