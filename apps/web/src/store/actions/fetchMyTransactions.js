/**
 * Fetch the current user's transactions/purchases
 *
 * Queries the myTransactions endpoint to get all purchases and subscriptions.
 * Data is stored in the myTransactions reducer (not queryResults) since
 * transactions are not ORM models.
 */

export const FETCH_MY_TRANSACTIONS = 'FETCH_MY_TRANSACTIONS'
export const APPLY_OPTIMISTIC_MEMBERSHIP_CHANGE = 'APPLY_OPTIMISTIC_MEMBERSHIP_CHANGE'

const query = `
query FetchMyTransactions (
  $first: Int,
  $offset: Int,
  $status: String,
  $accessType: String,
  $offeringId: ID,
  $paymentType: String
) {
  myTransactions (
    first: $first,
    offset: $offset,
    status: $status,
    accessType: $accessType,
    offeringId: $offeringId,
    paymentType: $paymentType
  ) {
    total
    hasMore
    items {
      id
      offeringName
      groupName
      trackName
      accessType
      status
      purchaseDate
      expiresAt
      paymentType
      subscriptionStatus
      currentPeriodEnd
      subscriptionCancelAtPeriodEnd
      subscriptionPeriodEnd
      subscriptionCancellationScheduledAt
      subscriptionCancelReason
      amountPaid
      currency
      manageUrl
      receiptUrl
      pendingMembershipSubscriptionChange {
        mode
        effectiveAt
        toOffering {
          id
          name
          duration
          priceInCents
          currency
        }
      }
      offering {
        id
        name
        duration
        priceInCents
      }
      group {
        id
        name
        slug
        avatarUrl
      }
      track {
        id
        name
      }
    }
  }
}
`

export default function fetchMyTransactions ({
  first = 50,
  offset = 0,
  status,
  accessType,
  offeringId,
  paymentType
} = {}) {
  return {
    type: FETCH_MY_TRANSACTIONS,
    graphql: {
      query,
      variables: {
        first,
        offset,
        status,
        accessType,
        offeringId,
        paymentType
      }
    }
  }
}

/**
 * After a successful membershipChangeCommit, patch the matching subscription row in the
 * store so My Transactions reflects the new plan without waiting for Stripe webhooks.
 */
export function applyOptimisticMembershipChange ({
  groupId,
  fromOfferingId,
  toOffering,
  amountPaid,
  currency
}) {
  return {
    type: APPLY_OPTIMISTIC_MEMBERSHIP_CHANGE,
    payload: {
      groupId: String(groupId),
      fromOfferingId: String(fromOfferingId),
      toOffering: {
        id: toOffering.id,
        name: toOffering.name,
        duration: toOffering.duration,
        priceInCents: toOffering.priceInCents
      },
      amountPaid,
      currency
    }
  }
}
