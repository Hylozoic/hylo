import gql from 'graphql-tag'

export default gql`
  mutation UnmuteMessageThreadMutation ($messageThreadId: ID) {
    unmuteMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
