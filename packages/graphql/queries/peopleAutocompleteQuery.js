import { gql } from 'urql'

export default gql`
  query PeopleAutocompleteQuery (
    $autocomplete: String,
    $first: Int = 10,
    $includeMemberships: Boolean = false
  ) {
    people (autocomplete: $autocomplete, first: $first) {
      items {
        id
        name
        avatarUrl
        memberships @include(if: $includeMemberships) {
          id
          group {
            id
            name
          }
        }
      }
    }
  }
`
