export const FULFILL_STRIPE_CHECKOUT_SESSION = 'FULFILL_STRIPE_CHECKOUT_SESSION'

/**
 * Grants access from a completed Stripe Checkout session (success-page fallback).
 */
export default function fulfillStripeCheckoutSession (sessionId, offeringId) {
  return {
    type: FULFILL_STRIPE_CHECKOUT_SESSION,
    graphql: {
      query: `mutation ($sessionId: ID!, $offeringId: ID) {
        fulfillStripeCheckoutSession(sessionId: $sessionId, offeringId: $offeringId) {
          success
          message
        }
      }`,
      variables: { sessionId, offeringId }
    }
  }
}
