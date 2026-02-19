/**
 * Fetch the current user's transactions/purchases
 *
 * Queries the myTransactions endpoint to get all purchases and subscriptions.
 * Data is stored in the myTransactions reducer (not queryResults) since
 * transactions are not ORM models.
 */

export const FETCH_MY_TRANSACTIONS = 'FETCH_MY_TRANSACTIONS'

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
      offering {
        id
        name
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
