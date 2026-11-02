export const MODULE_NAME = 'BillingTab'

export const FETCH_PRO_SUBSCRIPTION = `${MODULE_NAME}/FETCH_PRO_SUBSCRIPTION`
export const CREATE_PRO_CHECKOUT_SESSION = `${MODULE_NAME}/CREATE_PRO_CHECKOUT_SESSION`
export const CREATE_PRO_PORTAL_SESSION = `${MODULE_NAME}/CREATE_PRO_PORTAL_SESSION`

export function fetchProSubscription (groupId) {
  return {
    type: FETCH_PRO_SUBSCRIPTION,
    graphql: {
      query: `query HyloProSubscriptionQuery ($groupId: ID) {
        group(id: $groupId) {
          id
          hasPro
          proSubscription {
            id
            source
            status
            active
            interval
            currentPeriodEnd
            cancelAtPeriodEnd
            endsAt
            endedAt
          }
        }
      }`,
      variables: { groupId }
    }
  }
}

// interval: 'month' or 'year'
export function createProCheckoutSession (groupId, interval) {
  return {
    type: CREATE_PRO_CHECKOUT_SESSION,
    graphql: {
      query: `mutation CreateHyloProCheckoutSession ($groupId: ID!, $interval: String!) {
        createHyloProCheckoutSession(groupId: $groupId, interval: $interval) {
          url
        }
      }`,
      variables: { groupId, interval }
    }
  }
}

export function createProPortalSession (groupId) {
  return {
    type: CREATE_PRO_PORTAL_SESSION,
    graphql: {
      query: `mutation CreateHyloProPortalSession ($groupId: ID!) {
        createHyloProPortalSession(groupId: $groupId) {
          url
        }
      }`,
      variables: { groupId }
    }
  }
}
