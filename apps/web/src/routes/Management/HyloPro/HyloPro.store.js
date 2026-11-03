// Hylo Pro management (Hylo staff only; the server refuses everyone else)
export const MODULE_NAME = 'HyloProManagement'

export const FETCH_HYLO_PRO_METRICS = `${MODULE_NAME}/FETCH_HYLO_PRO_METRICS`
export const FETCH_HYLO_PRO_SUBSCRIPTIONS = `${MODULE_NAME}/FETCH_HYLO_PRO_SUBSCRIPTIONS`
export const FETCH_HYLO_PRO_PAYMENTS = `${MODULE_NAME}/FETCH_HYLO_PRO_PAYMENTS`
export const GRANT_HYLO_PRO = `${MODULE_NAME}/GRANT_HYLO_PRO`
export const UPDATE_HYLO_PRO_GRANT = `${MODULE_NAME}/UPDATE_HYLO_PRO_GRANT`
export const REVOKE_HYLO_PRO_GRANT = `${MODULE_NAME}/REVOKE_HYLO_PRO_GRANT`
export const CANCEL_HYLO_PRO_SUBSCRIPTION = `${MODULE_NAME}/CANCEL_HYLO_PRO_SUBSCRIPTION`
export const RESUME_HYLO_PRO_SUBSCRIPTION = `${MODULE_NAME}/RESUME_HYLO_PRO_SUBSCRIPTION`
export const EXTEND_HYLO_PRO_SUBSCRIPTION = `${MODULE_NAME}/EXTEND_HYLO_PRO_SUBSCRIPTION`
export const REFUND_HYLO_PRO_PAYMENT = `${MODULE_NAME}/REFUND_HYLO_PRO_PAYMENT`

const ROW_FIELDS = `
  id
  source
  status
  active
  interval
  group { id name slug }
  grantedBy { id name }
  note
  expiresAt
  stripeSubscriptionId
  stripeCustomerId
  currentPeriodEnd
  cancelAtPeriodEnd
  endsAt
  canceledAt
  endedAt
  createdAt
`

export function fetchHyloProMetrics () {
  return {
    type: FETCH_HYLO_PRO_METRICS,
    graphql: {
      query: `query HyloProMetrics {
        hyloProMetrics {
          activeGroups
          stripeGroups
          manualGroups
          monthlySubscriptions
          yearlySubscriptions
          trialing
          cancelling
          pastDue
          grantsExpiringSoon
          mrrCents
          currency
          months { month newSubscriptions cancellations ended grants }
        }
      }`
    }
  }
}

export function fetchHyloProSubscriptions ({ filter, search, first, offset } = {}) {
  return {
    type: FETCH_HYLO_PRO_SUBSCRIPTIONS,
    graphql: {
      query: `query HyloProSubscriptions ($filter: String, $search: String, $first: Int, $offset: Int) {
        hyloProSubscriptions(filter: $filter, search: $search, first: $first, offset: $offset) {
          total
          hasMore
          items {${ROW_FIELDS}}
        }
      }`,
      variables: { filter, search: search || null, first, offset }
    }
  }
}

export function fetchHyloProPayments (groupId) {
  return {
    type: FETCH_HYLO_PRO_PAYMENTS,
    graphql: {
      query: `query HyloProPayments ($groupId: ID!) {
        hyloProPayments(groupId: $groupId) {
          id
          amount
          amountRefunded
          currency
          status
          paid
          refunded
          description
          createdAt
        }
      }`,
      variables: { groupId }
    }
  }
}

export function grantHyloPro ({ groupId, expiresAt, note }) {
  return {
    type: GRANT_HYLO_PRO,
    graphql: {
      query: `mutation GrantHyloPro ($groupId: ID!, $expiresAt: Date, $note: String) {
        grantHyloPro(groupId: $groupId, expiresAt: $expiresAt, note: $note) {${ROW_FIELDS}}
      }`,
      variables: { groupId, expiresAt: expiresAt || null, note: note || null }
    }
  }
}

// expiresAt null = no end date
export function updateHyloProGrant ({ id, expiresAt }) {
  return {
    type: UPDATE_HYLO_PRO_GRANT,
    graphql: {
      query: `mutation UpdateHyloProGrant ($id: ID!, $expiresAt: Date) {
        updateHyloProGrant(id: $id, expiresAt: $expiresAt) {${ROW_FIELDS}}
      }`,
      variables: { id, expiresAt: expiresAt || null }
    }
  }
}

export function revokeHyloProGrant (id) {
  return {
    type: REVOKE_HYLO_PRO_GRANT,
    graphql: {
      query: `mutation RevokeHyloProGrant ($id: ID!) {
        revokeHyloProGrant(id: $id) {${ROW_FIELDS}}
      }`,
      variables: { id }
    }
  }
}

export function cancelHyloProSubscription (id, immediately) {
  return {
    type: CANCEL_HYLO_PRO_SUBSCRIPTION,
    graphql: {
      query: `mutation CancelHyloProSubscription ($id: ID!, $immediately: Boolean) {
        cancelHyloProSubscription(id: $id, immediately: $immediately) {${ROW_FIELDS}}
      }`,
      variables: { id, immediately: !!immediately }
    }
  }
}

export function resumeHyloProSubscription (id) {
  return {
    type: RESUME_HYLO_PRO_SUBSCRIPTION,
    graphql: {
      query: `mutation ResumeHyloProSubscription ($id: ID!) {
        resumeHyloProSubscription(id: $id) {${ROW_FIELDS}}
      }`,
      variables: { id }
    }
  }
}

export function extendHyloProSubscription (id, days) {
  return {
    type: EXTEND_HYLO_PRO_SUBSCRIPTION,
    graphql: {
      query: `mutation ExtendHyloProSubscription ($id: ID!, $days: Int!) {
        extendHyloProSubscription(id: $id, days: $days) {${ROW_FIELDS}}
      }`,
      variables: { id, days }
    }
  }
}

// amount in cents; omit for a full refund
export function refundHyloProPayment ({ groupId, chargeId, amount }) {
  return {
    type: REFUND_HYLO_PRO_PAYMENT,
    graphql: {
      query: `mutation RefundHyloProPayment ($groupId: ID!, $chargeId: String!, $amount: Int) {
        refundHyloProPayment(groupId: $groupId, chargeId: $chargeId, amount: $amount) {
          id
          amount
          currency
          status
        }
      }`,
      variables: { groupId, chargeId, amount: amount ?? null }
    }
  }
}
