/**
 * PaidContentTab Store
 *
 * Redux store module for managing Stripe Connect paid content functionality.
 * Handles connected account creation, onboarding, and product management.
 */

import { get } from 'lodash/fp'
import contentAccessQuery from '@graphql/queries/contentAccessQuery'

export const MODULE_NAME = 'PaidContentTab'

export const CREATE_CONNECTED_ACCOUNT = `${MODULE_NAME}/CREATE_CONNECTED_ACCOUNT`
export const CREATE_ACCOUNT_LINK = `${MODULE_NAME}/CREATE_ACCOUNT_LINK`
export const FETCH_ACCOUNT_STATUS = `${MODULE_NAME}/FETCH_ACCOUNT_STATUS`
export const CHECK_STRIPE_STATUS = `${MODULE_NAME}/CHECK_STRIPE_STATUS`
export const CREATE_OFFERING = `${MODULE_NAME}/CREATE_OFFERING`
export const UPDATE_OFFERING = `${MODULE_NAME}/UPDATE_OFFERING`
export const FETCH_OFFERINGS = `${MODULE_NAME}/FETCH_OFFERINGS`
export const FETCH_CONTENT_ACCESS = `${MODULE_NAME}/FETCH_CONTENT_ACCESS`

/**
 * Creates a Stripe Connected Account for the group
 *
 * This allows the group to receive payments directly while the platform
 * takes an application fee. If the user already has a Stripe account,
 * Stripe will prompt them to connect it during onboarding.
 */
export function createConnectedAccount (groupId, email, businessName, country = 'US') {
  return {
    type: CREATE_CONNECTED_ACCOUNT,
    graphql: {
      query: `mutation ($groupId: ID!, $email: String!, $businessName: String!, $country: String) {
        createStripeConnectedAccount(
          groupId: $groupId
          email: $email
          businessName: $businessName
          country: $country
        ) {
          id
          accountId
          success
          message
        }
      }`,
      variables: {
        groupId,
        email,
        businessName,
        country
      }
    }
  }
}

/**
 * Creates an Account Link for onboarding
 *
 * Generates a temporary URL that allows the connected account to complete
 * their onboarding process and gain access to the Stripe Dashboard.
 */
export function createAccountLink (groupId, accountId, returnUrl, refreshUrl) {
  return {
    type: CREATE_ACCOUNT_LINK,
    graphql: {
      query: `mutation ($groupId: ID!, $accountId: String!, $returnUrl: String!, $refreshUrl: String!) {
        createStripeAccountLink(
          groupId: $groupId
          accountId: $accountId
          returnUrl: $returnUrl
          refreshUrl: $refreshUrl
        ) {
          url
          expiresAt
          success
        }
      }`,
      variables: {
        groupId,
        accountId,
        returnUrl,
        refreshUrl
      }
    }
  }
}

/**
 * Fetches the current status of a connected account
 *
 * Retrieves onboarding status, payment capabilities, and requirements
 * directly from Stripe.
 */
export function fetchAccountStatus (groupId, accountId) {
  return {
    type: FETCH_ACCOUNT_STATUS,
    graphql: {
      query: `query ($groupId: ID!, $accountId: String!) {
        stripeAccountStatus(
          groupId: $groupId
          accountId: $accountId
        ) {
          accountId
          chargesEnabled
          payoutsEnabled
          detailsSubmitted
          email
          requirements
        }
      }`,
      variables: {
        groupId,
        accountId
      }
    }
  }
}

/**
 * Creates an offering on the connected account
 *
 * Offerings represent subscription tiers, content access, or other offerings
 * that the group wants to sell.
 */
export function createOffering (groupId, accountId, name, description, priceInCents, currency = 'usd', accessGrants = null, duration = null, publishStatus = 'unpublished') {
  return {
    type: CREATE_OFFERING,
    graphql: {
      query: `mutation ($input: StripeOfferingInput!) {
        createStripeOffering(input: $input) {
          productId
          priceId
          name
          success
          message
        }
      }`,
      variables: {
        input: {
          groupId,
          accountId,
          name,
          description,
          priceInCents,
          currency,
          accessGrants,
          duration,
          publishStatus
        }
      }
    }
  }
}

/**
 * Checks Stripe account status and updates the database
 *
 * Fetches the current status from Stripe and updates the group's
 * stripe status fields in the database.
 */
export function checkStripeStatus (groupId) {
  return {
    type: CHECK_STRIPE_STATUS,
    graphql: {
      query: `mutation ($groupId: ID!) {
        checkStripeStatus(groupId: $groupId) {
          success
          message
          chargesEnabled
          payoutsEnabled
          detailsSubmitted
        }
      }`,
      variables: {
        groupId
      }
    }
  }
}

/**
 * Fetches all offerings for a connected account
 *
 * Lists all active offerings that the group has created for sale.
 */
export function fetchOfferings (groupId, accountId) {
  return {
    type: FETCH_OFFERINGS,
    graphql: {
      query: `query ($groupId: ID!, $accountId: String!) {
        stripeOfferings(
          groupId: $groupId
          accountId: $accountId
        ) {
          offerings {
            id
            name
            description
            priceInCents
            currency
            stripeProductId
            stripePriceId
            accessGrants
            publishStatus
            duration
            tracks {
              id
              name
              bannerUrl
              description
            }
            roles {
              id
              name
              emoji
            }
          }
          success
        }
      }`,
      variables: {
        groupId,
        accountId
      }
    }
  }
}

/**
 * Updates an existing Stripe offering
 *
 * Allows updating offering details including name, description, price, etc.
 */
export function updateOffering (offeringId, updates) {
  const { name, description, priceInCents, currency, accessGrants, renewalPolicy, duration, publishStatus } = updates || {}

  return {
    type: UPDATE_OFFERING,
    graphql: {
      query: `mutation ($offeringId: ID!, $name: String, $description: String, $priceInCents: Int, $currency: String, $accessGrants: JSON, $renewalPolicy: String, $duration: String, $publishStatus: PublishStatus) {
        updateStripeOffering(
          offeringId: $offeringId
          name: $name
          description: $description
          priceInCents: $priceInCents
          currency: $currency
          accessGrants: $accessGrants
          renewalPolicy: $renewalPolicy
          duration: $duration
          publishStatus: $publishStatus
        ) {
          success
          message
        }
      }`,
      variables: {
        offeringId,
        name,
        description,
        priceInCents,
        currency,
        accessGrants,
        renewalPolicy,
        duration,
        publishStatus
      }
    }
  }
}

/**
 * Fetches content access records for a group
 *
 * Lists all content access grants (purchased and admin-granted) for the group.
 * Supports filtering and pagination.
 */
export function fetchContentAccess ({
  groupIds,
  search = '',
  accessType = null,
  status = null,
  offeringId = null,
  trackId = null,
  groupRoleId = null,
  commonRoleId = null,
  first = 20,
  offset = 0,
  order = 'desc',
  sortBy = 'created_at'
}) {
  return {
    type: FETCH_CONTENT_ACCESS,
    graphql: {
      query: contentAccessQuery,
      variables: {
        groupIds,
        search,
        accessType,
        status,
        offeringId,
        trackId,
        groupRoleId,
        commonRoleId,
        first,
        offset,
        order,
        sortBy
      }
    }
  }
}

/**
 * Selector to get account status from state
 */
export function getAccountStatus (state) {
  return get('PaidContentTab.accountStatus', state)
}

/**
 * Selector to get offerings from state
 */
export function getOfferings (state) {
  return get('PaidContentTab.offerings', state) || []
}

/**
 * Selector to get content access records directly from state
 */
export function getContentAccessRecords (state) {
  return get('PaidContentTab.contentAccess', state) || { items: [], total: 0, hasMore: false }
}

/**
 * Reducer for PaidContentTab state
 */
export default function reducer (state = {}, action) {
  const { type, payload, error } = action

  if (error) return state

  switch (type) {
    case FETCH_ACCOUNT_STATUS:
      return {
        ...state,
        accountStatus: payload?.data?.stripeAccountStatus
      }

    case FETCH_OFFERINGS:
      return {
        ...state,
        offerings: payload?.data?.stripeOfferings?.offerings || []
      }

    case FETCH_CONTENT_ACCESS:
      return {
        ...state,
        contentAccess: payload?.data?.contentAccess || { items: [], total: 0, hasMore: false }
      }

    default:
      return state
  }
}
