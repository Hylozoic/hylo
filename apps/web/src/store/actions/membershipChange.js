/**
 * GraphQL actions for membership subscription change (v1).
 */

export const FETCH_MEMBERSHIP_CHANGE_ELIGIBLE = 'FETCH_MEMBERSHIP_CHANGE_ELIGIBLE'
export const FETCH_MEMBERSHIP_CHANGE_PREVIEW = 'FETCH_MEMBERSHIP_CHANGE_PREVIEW'
export const FETCH_MEMBERSHIP_CHANGE_INVOICE_PREVIEW = 'FETCH_MEMBERSHIP_CHANGE_INVOICE_PREVIEW'
export const MEMBERSHIP_CHANGE_COMMIT = 'MEMBERSHIP_CHANGE_COMMIT'

const eligibleQuery = `
  query MembershipChangeEligibleOfferings ($groupId: ID!) {
    membershipChangeEligibleOfferings(groupId: $groupId) {
      success
      offerings {
        id
        name
        description
        priceInCents
        currency
        duration
        stripePriceId
        metadata
        accessGrants
      }
    }
  }
`

const previewQuery = `
  query MembershipChangePreview (
    $groupId: ID!
    $fromOfferingId: ID!
    $toOfferingId: ID!
    $isPastDue: Boolean
    $isSlidingScaleQuantityOnly: Boolean
  ) {
    membershipChangePreview(
      groupId: $groupId
      fromOfferingId: $fromOfferingId
      toOfferingId: $toOfferingId
      isPastDue: $isPastDue
      isSlidingScaleQuantityOnly: $isSlidingScaleQuantityOnly
    ) {
      mode
      reason
      meta
    }
  }
`

const invoicePreviewQuery = `
  query MembershipChangeInvoicePreview (
    $groupId: ID!
    $fromOfferingId: ID!
    $toOfferingId: ID!
  ) {
    membershipChangeInvoicePreview(
      groupId: $groupId
      fromOfferingId: $fromOfferingId
      toOfferingId: $toOfferingId
    ) {
      mode
      reason
      amountDue
      currency
      subtotal
      total
      nextPaymentAttempt
      lines {
        description
        amount
        currency
        proration
      }
      hyloPrepaidCreditCents
    }
  }
`

const commitMutation = `
  mutation MembershipChangeCommit (
    $groupId: ID!
    $fromOfferingId: ID!
    $toOfferingId: ID!
    $newQuantity: Int
  ) {
    membershipChangeCommit(
      groupId: $groupId
      fromOfferingId: $fromOfferingId
      toOfferingId: $toOfferingId
      newQuantity: $newQuantity
    ) {
      success
      message
      mode
      subscriptionChangeEventId
    }
  }
`

export function fetchMembershipChangeEligibleOfferings ({ groupId }) {
  return {
    type: FETCH_MEMBERSHIP_CHANGE_ELIGIBLE,
    graphql: {
      query: eligibleQuery,
      variables: { groupId }
    }
  }
}

export function fetchMembershipChangePreview ({
  groupId,
  fromOfferingId,
  toOfferingId,
  isPastDue = false,
  isSlidingScaleQuantityOnly = false
}) {
  return {
    type: FETCH_MEMBERSHIP_CHANGE_PREVIEW,
    graphql: {
      query: previewQuery,
      variables: {
        groupId,
        fromOfferingId,
        toOfferingId,
        isPastDue,
        isSlidingScaleQuantityOnly
      }
    }
  }
}

export function fetchMembershipChangeInvoicePreview ({
  groupId,
  fromOfferingId,
  toOfferingId
}) {
  return {
    type: FETCH_MEMBERSHIP_CHANGE_INVOICE_PREVIEW,
    graphql: {
      query: invoicePreviewQuery,
      variables: {
        groupId,
        fromOfferingId,
        toOfferingId
      }
    }
  }
}

export function commitMembershipChange ({
  groupId,
  fromOfferingId,
  toOfferingId,
  newQuantity
}) {
  return {
    type: MEMBERSHIP_CHANGE_COMMIT,
    graphql: {
      query: commitMutation,
      variables: {
        groupId,
        fromOfferingId,
        toOfferingId,
        newQuantity: newQuantity != null ? newQuantity : null
      }
    }
  }
}
