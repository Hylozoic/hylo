import { gql } from 'urql'

export default gql`
  mutation BlockUserMutation ($blockedUserId: ID) {
    blockUser (blockedUserId: $blockedUserId) {
      success
    }
  }
`
