import { gql } from 'urql'

export default gql`
  query PeopleQuery (
    $first: Int,
    $autocomplete: String,
    $groupIds: [ID],
    $offset: Int
  ) {
    groups(groupIds: $groupIds) {
      items {
        id
        members(first: $first, offset: $offset, search: $autocomplete, sortBy: "name", order: "asc") {
          items {
            id
            name
            avatarUrl
          }
        }
      }
    }
  }
`
