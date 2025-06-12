import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'

export default gql`
  query FetchMyTracks($autocomplete: String, $first: Int, $offset: Int, $order: String, $sortBy: String) {
    me {
      id
      tracksEnrolledIn(autocomplete: $autocomplete, first: $first, offset: $offset, sortBy: $sortBy, order: $order) {
        items {
          ...TrackFields
          groups {
            items {
              id
              avatarUrl
              name
              slug
            }
          }
        }
      }
    }
  }
  ${trackFieldsFragment}
`
