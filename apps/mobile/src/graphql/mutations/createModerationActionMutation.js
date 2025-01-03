import { gql } from 'urql'

export default gql`
  mutation CreateModerationActionMutation ($data: ModerationActionInput) {
    createModerationAction (data: $data) {
      id
      postId
      groupId
      text
      anonymous
      agreements {
        id
      }
      platformAgreements {
        id
      }
    }
  }
`
