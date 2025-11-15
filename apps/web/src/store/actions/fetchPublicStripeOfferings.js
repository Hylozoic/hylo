import { get } from 'lodash/fp'
import { FETCH_PUBLIC_STRIPE_OFFERINGS } from 'store/constants'

const query = `
  query ($groupId: ID!) {
    publicStripeOfferings(groupId: $groupId) {
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
  }
`

export default function fetchPublicStripeOfferings ({ groupId }) {
  return {
    type: FETCH_PUBLIC_STRIPE_OFFERINGS,
    graphql: {
      query,
      variables: {
        groupId
      }
    },
    meta: {
      extractQueryResults: {
        getItems: get('payload.data.publicStripeOfferings.offerings')
      }
    }
  }
}

