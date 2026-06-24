import gql from 'graphql-tag'

/**
 * Query for searching all users on the platform using autocomplete.
 * Unlike PeopleQuery which queries through groups.members,
 * this uses the root-level people query which can search all users.
 */
const PeopleAutocompleteQuery = gql`
  query PeopleAutocompleteQuery ($autocomplete: String, $first: Int) {
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

export default PeopleAutocompleteQuery
