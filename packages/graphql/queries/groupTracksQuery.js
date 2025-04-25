import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'

export default gql`
  query GroupTracksQuery(
    $id: ID,
    $first: Int = 20,
    $offset: Int = 0,
    $sortBy: String = "published_at",
    $order: String = "desc",
    $enrolled: Boolean,
    $autocomplete: String
  ) {
    group(id: $id) {
      id
      tracks(
        autocomplete: $autocomplete,
        enrolled: $enrolled,
        first: $first,
        offset: $offset,
        sortBy: $sortBy,
        order: $order
      ) {
        items {
          ...TrackFields
        }
      }
    }
  }
  ${trackFieldsFragment}
`
