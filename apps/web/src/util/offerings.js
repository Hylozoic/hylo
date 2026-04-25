/**
 * Utility functions for working with Stripe offerings
 */

/**
 * Creates a Stripe checkout session for an offering
 *
 * @param {Object} params - Parameters for checkout
 * @param {string|number} params.groupId - The group ID
 * @param {string|number} params.offeringId - The offering ID
 * @param {number} [params.quantity=1] - Quantity to purchase
 * @param {string} params.successUrl - URL to redirect to after successful payment
 * @param {string} params.cancelUrl - URL to redirect to after cancelled payment
 * @param {Object} [params.metadata={}] - Additional metadata to pass to Stripe
 * @returns {Promise<Object>} Promise that resolves to checkout session data with url
 */
export async function createStripeCheckoutSession ({
  groupId,
  offeringId,
  quantity = 1,
  successUrl,
  cancelUrl,
  metadata = {}
}) {
  const mutation = `
    mutation ($groupId: ID!, $offeringId: ID!, $quantity: Int, $successUrl: String!, $cancelUrl: String!, $metadata: JSON) {
      createStripeCheckoutSession(
        groupId: $groupId
        offeringId: $offeringId
        quantity: $quantity
        successUrl: $successUrl
        cancelUrl: $cancelUrl
        metadata: $metadata
      ) {
        sessionId
        url
        success
      }
    }
  `

  const response = await fetch('/noo/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      query: mutation,
      variables: {
        groupId,
        offeringId,
        quantity,
        successUrl,
        cancelUrl,
        metadata: {
          offeringId,
          groupId,
          ...metadata
        }
      }
    })
  })

  const result = await response.json()

  if (result.errors) {
    throw new Error(result.errors[0].message)
  }

  const checkoutData = result.data?.createStripeCheckoutSession

  if (!checkoutData?.url) {
    throw new Error('No checkout URL returned')
  }

  return checkoutData
}

