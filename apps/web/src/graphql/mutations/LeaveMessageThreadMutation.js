import gql from 'graphql-tag'

export default gql`
  mutation LeaveMessageThreadMutation ($messageThreadId: ID) {
    leaveMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
