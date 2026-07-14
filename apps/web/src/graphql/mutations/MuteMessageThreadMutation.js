import gql from 'graphql-tag'

export default gql`
  mutation MuteMessageThreadMutation ($messageThreadId: ID) {
    muteMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
