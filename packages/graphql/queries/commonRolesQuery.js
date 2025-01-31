import { gql } from 'urql'

export default gql`
  query CommonRolesQuery {
    commonRoles {
      id
      name
      description
      emoji
      responsibilities {
        items {
          id
          title
          description
        }
      }
    }
  }
`
