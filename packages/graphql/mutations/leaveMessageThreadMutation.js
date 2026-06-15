import { gql } from 'urql'

export default gql`
  mutation LeaveMessageThreadMutation ($messageThreadId: ID) {
    leaveMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
