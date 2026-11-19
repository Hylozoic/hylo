export const MODULE_NAME = 'BillingTab'

export const FETCH_PRO_BILLING = `${MODULE_NAME}/FETCH_PRO_BILLING`
export const CREATE_PRO_CHECKOUT_SESSION = `${MODULE_NAME}/CREATE_PRO_CHECKOUT_SESSION`
export const CREATE_PRO_PORTAL_SESSION = `${MODULE_NAME}/CREATE_PRO_PORTAL_SESSION`
export const ACTIVATE_PRO_CHECKOUT_SESSION = `${MODULE_NAME}/ACTIVATE_PRO_CHECKOUT_SESSION`

const SUBSCRIPTION_FIELDS = `
  id
  source
  status
  active
  interval
  currentPeriodEnd
  cancelAtPeriodEnd
  endsAt
  endedAt
`

export function fetchProBilling (groupId) {
  return {
    type: FETCH_PRO_BILLING,
    graphql: {
      query: `query HyloProBillingQuery ($groupId: ID) {
        group(id: $groupId) {
          id
          proBilling {
            hasPro
            canUpgrade
            canManage
            needsPaymentUpdate
            subscription {${SUBSCRIPTION_FIELDS}}
            grant {${SUBSCRIPTION_FIELDS}}
            plans {
              interval
              unitAmount
              currency
            }
          }
        }
      }`,
      variables: { groupId }
    }
  }
}

// Called on return from Checkout, so Pro activates without waiting for Stripe's webhook
export function activateProCheckoutSession (groupId, sessionId) {
  return {
    type: ACTIVATE_PRO_CHECKOUT_SESSION,
    graphql: {
      query: `mutation ActivateHyloProCheckoutSession ($groupId: ID!, $sessionId: String!) {
        activateHyloProCheckoutSession(groupId: $groupId, sessionId: $sessionId) {
          success
          active
        }
      }`,
      variables: { groupId, sessionId }
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
