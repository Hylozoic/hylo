import { gql } from 'urql'

export default gql`
  query GroupRolesQuery($groupId: ID!) {
    group(id: $groupId) {
      id
      mode
      groupRoles {
        items {
          id
          name
          description
          emoji
          active
          assignment
          status
          thresholdCurrent
          thresholdRequired
          bootstrap
          stewards {
            items {
              id
              name
              avatarUrl
            }
          }
        }
      }
    }
  }
` 