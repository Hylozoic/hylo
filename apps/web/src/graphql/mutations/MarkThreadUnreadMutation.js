import gql from 'graphql-tag'

export const MarkThreadUnreadMutation = gql`
  mutation MarkThreadUnreadMutation ($messageThreadId: ID) {
    markThreadUnread(messageThreadId: $messageThreadId) {
      id
      unreadCount
      lastReadAt
    }
  }
`

export default MarkThreadUnreadMutation
