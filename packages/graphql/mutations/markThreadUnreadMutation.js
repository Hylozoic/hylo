import { gql } from 'urql'

export default gql`
  mutation MarkThreadUnreadMutation ($messageThreadId: ID) {
    markThreadUnread(messageThreadId: $messageThreadId) {
      id
      unreadCount
      lastReadAt
    }
  }
`
