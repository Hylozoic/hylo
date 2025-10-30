/**
 * PaidContentTab Store
 *
 * Redux store module for managing Stripe Connect paid content functionality.
 * Handles connected account creation, onboarding, and product management.
 */

import { get } from 'lodash/fp'

export const MODULE_NAME = 'PaidContentTab'

export const CREATE_CONNECTED_ACCOUNT = `${MODULE_NAME}/CREATE_CONNECTED_ACCOUNT`
export const CREATE_ACCOUNT_LINK = `${MODULE_NAME}/CREATE_ACCOUNT_LINK`
export const FETCH_ACCOUNT_STATUS = `${MODULE_NAME}/FETCH_ACCOUNT_STATUS`
export const CHECK_STRIPE_STATUS = `${MODULE_NAME}/CHECK_STRIPE_STATUS`
export const CREATE_PRODUCT = `${MODULE_NAME}/CREATE_PRODUCT`
export const UPDATE_PRODUCT = `${MODULE_NAME}/UPDATE_PRODUCT`
export const FETCH_PRODUCTS = `${MODULE_NAME}/FETCH_PRODUCTS`

/**
 * Creates a Stripe Connected Account for the group
 *
 * This allows the group to receive payments directly while the platform
 * takes an application fee. Can create a new account or connect an existing one.
 */
export function createConnectedAccount (groupId, email, businessName, country = 'US', existingAccountId = null) {
  return {
    type: CREATE_CONNECTED_ACCOUNT,
    graphql: {
      query: `mutation ($groupId: ID!, $email: String!, $businessName: String!, $country: String, $existingAccountId: String) {
        createStripeConnectedAccount(
          groupId: $groupId
          email: $email
          businessName: $businessName
          country: $country
          existingAccountId: $existingAccountId
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
        country,
        existingAccountId
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
 * Creates a product on the connected account
 *
 * Products represent subscription tiers, content access, or other offerings
 * that the group wants to sell.
 */
export function createProduct (groupId, accountId, name, description, priceInCents, currency = 'usd') {
  return {
    type: CREATE_PRODUCT,
    graphql: {
      query: `mutation ($groupId: ID!, $accountId: String!, $name: String!, $description: String, $priceInCents: Int!, $currency: String) {
        createStripeProduct(
          groupId: $groupId
          accountId: $accountId
          name: $name
          description: $description
          priceInCents: $priceInCents
          currency: $currency
        ) {
          productId
          priceId
          name
          success
          message
        }
      }`,
      variables: {
        groupId,
        accountId,
        name,
        description,
        priceInCents,
        currency
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
 * Fetches all products for a connected account
 *
 * Lists all active products that the group has created for sale.
 */
export function fetchProducts (groupId, accountId) {
  return {
    type: FETCH_PRODUCTS,
    graphql: {
      query: `query ($groupId: ID!, $accountId: String!) {
        stripeProducts(
          groupId: $groupId
          accountId: $accountId
        ) {
          products {
            id
            name
            description
            defaultPriceId
            images
            active
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
 * Updates an existing Stripe product
 *
 * Allows updating product details including name, description, price, etc.
 */
export function updateProduct (productId, updates) {
  const { name, description, priceInCents, currency, contentAccess, renewalPolicy, duration, publishStatus } = updates || {}

  return {
    type: UPDATE_PRODUCT,
    graphql: {
      query: `mutation ($productId: ID!, $name: String, $description: String, $priceInCents: Int, $currency: String, $contentAccess: JSON, $renewalPolicy: String, $duration: String, $publishStatus: PublishStatus) {
        updateStripeProduct(
          productId: $productId
          name: $name
          description: $description
          priceInCents: $priceInCents
          currency: $currency
          contentAccess: $contentAccess
          renewalPolicy: $renewalPolicy
          duration: $duration
          publishStatus: $publishStatus
        ) {
          success
          message
        }
      }`,
      variables: {
        productId,
        name,
        description,
        priceInCents,
        currency,
        contentAccess,
        renewalPolicy,
        duration,
        publishStatus
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
 * Selector to get products from state
 */
export function getProducts (state) {
  return get('PaidContentTab.products', state) || []
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

    case FETCH_PRODUCTS:
      return {
        ...state,
        products: payload?.data?.stripeProducts?.products || []
      }

    default:
      return state
  }
}
