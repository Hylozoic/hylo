export default `
  query ContentAccessQuery (
    $groupIds: [ID],
    $search: String,
    $accessType: String,
    $status: String,
    $offeringId: ID,
    $trackId: ID,
    $groupRoleId: ID,
    $commonRoleId: ID,
    $first: Int,
    $offset: Int,
    $order: String,
    $sortBy: String
  ) {
    contentAccess (
      groupIds: $groupIds,
      search: $search,
      accessType: $accessType,
      status: $status,
      offeringId: $offeringId,
      trackId: $trackId,
      groupRoleId: $groupRoleId,
      commonRoleId: $commonRoleId,
      first: $first,
      offset: $offset,
      order: $order,
      sortBy: $sortBy
    ) {
      total
      hasMore
      items {
        id
        createdAt
        updatedAt
        accessType
        status
        expiresAt
        metadata
        subscriptionCancelAtPeriodEnd
        subscriptionPeriodEnd
        subscriptionCancellationScheduledAt
        subscriptionCancelReason
        user {
          id
          name
          avatarUrl
        }
        grantedByGroup {
          id
          name
          slug
        }
        group {
          id
          name
          slug
        }
        offering {
          id
          name
          description
          priceInCents
          currency
          duration
        }
        track {
          id
          name
        }
        groupRole {
          id
          name
          emoji
        }
        commonRole {
          id
          name
          emoji
        }
        grantedBy {
          id
          name
          avatarUrl
        }
      }
    }
  }
`

