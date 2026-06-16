import { gql } from 'urql'

export default gql`
  mutation UnmuteMessageThreadMutation ($messageThreadId: ID) {
    unmuteMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
