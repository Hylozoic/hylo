import { get } from 'lodash/fp'
import { FETCH_PUBLIC_STRIPE_OFFERING } from 'store/constants'

const query = `
  query ($offeringId: ID!) {
    publicStripeOffering(offeringId: $offeringId) {
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
      group {
        id
        name
        slug
        avatarUrl
        bannerUrl
      }
    }
  }
`

export default function fetchPublicStripeOffering ({ offeringId }) {
  return {
    type: FETCH_PUBLIC_STRIPE_OFFERING,
    graphql: {
      query,
      variables: {
        offeringId
      }
    },
    meta: {
      extractQueryResults: {
        getItems: get('payload.data.publicStripeOffering')
      }
    }
  }
}
