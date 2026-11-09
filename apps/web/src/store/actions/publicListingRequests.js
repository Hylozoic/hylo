export const FETCH_PUBLIC_LISTING_REQUESTS = 'FETCH_PUBLIC_LISTING_REQUESTS'
export const REQUEST_PUBLIC_LISTING = 'REQUEST_PUBLIC_LISTING'
export const REVIEW_PUBLIC_LISTING_REQUEST = 'REVIEW_PUBLIC_LISTING_REQUEST'

export const publicListingRequestFields = `
  status
  message
  requestedAt
  reviewedAt
  reviewMessage
`

// Admin only: groups that have asked to be added to the commons
export function fetchPublicListingRequests (status) {
  return {
    type: FETCH_PUBLIC_LISTING_REQUESTS,
    graphql: {
      query: `
        query PublicListingRequests ($status: String) {
          publicListingRequests (status: $status) {
            id
            name
            slug
            avatarUrl
            allowInPublic
            memberCount
            publicListingRequest {
              ${publicListingRequestFields}
              requestedBy {
                id
                name
              }
              reviewedBy {
                id
                name
              }
            }
          }
        }
      `,
      variables: { status: status || null }
    }
  }
}

// Group administrators ask the Hylo team to add their public group to the commons
export function requestPublicListing (groupId, message) {
  return {
    type: REQUEST_PUBLIC_LISTING,
    graphql: {
      query: `
        mutation RequestPublicListing ($groupId: ID!, $message: String) {
          requestPublicListing (groupId: $groupId, message: $message) {
            id
            allowInPublic
            publicListingRequest {
              ${publicListingRequestFields}
            }
          }
        }
      `,
      variables: { groupId, message: message || null }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}

// Admin only: approve or deny a pending request; the requester is emailed either way
export function reviewPublicListingRequest (groupId, approved, message) {
  return {
    type: REVIEW_PUBLIC_LISTING_REQUEST,
    graphql: {
      query: `
        mutation ReviewPublicListingRequest ($groupId: ID!, $approved: Boolean!, $message: String) {
          reviewPublicListingRequest (groupId: $groupId, approved: $approved, message: $message) {
            id
            allowInPublic
          }
        }
      `,
      variables: { groupId, approved, message: message || null }
    }
  }
}
