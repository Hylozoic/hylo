import { gql } from 'urql'

export default gql`
  mutation MuteMessageThreadMutation ($messageThreadId: ID) {
    muteMessageThread(messageThreadId: $messageThreadId) {
      success
    }
  }
`
