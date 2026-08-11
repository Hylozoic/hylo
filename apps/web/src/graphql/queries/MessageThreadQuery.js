import gql from 'graphql-tag'

export const MessageThreadQuery = gql`
  query MessageThreadQuery ($id: ID) {
    messageThread (id: $id) {
      id
      unreadCount
      lastReadAt
      isMuted
      createdAt
      updatedAt
      participants {
        id
        name
        avatarUrl
      }
      messages(first: 80, order: "desc") {
        items {
          id
          text
          attachments {
            id
            position
            type
            url
          }
          creator {
            id
            name
            avatarUrl
          }
          createdAt
          editedAt
        }
        total
        hasMore
      }
    }
  }
`

export default MessageThreadQuery
