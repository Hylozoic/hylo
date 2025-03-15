import { gql } from 'urql'

export default gql`
  query PeopleAutocompleteQuery ($autocomplete: String, $first: Int = 10) {
    people (autocomplete: $autocomplete, first: $first) {
      items {
        id
        name
        avatarUrl
        memberships {
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
