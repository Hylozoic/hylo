import gql from 'graphql-tag'

const PeopleQuery = gql`
  query PeopleQuery (
    $first: Int,
    $autocomplete: String,
    $groupIds: [ID],
    $offset: Int,
    $includeMemberships: Boolean = false
  ) {
    groups(groupIds: $groupIds) {
      items {
        id
        members(first: $first, offset: $offset, search: $autocomplete, sortBy: "name", order: "asc") {
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
    }
  }
`

export default PeopleQuery
