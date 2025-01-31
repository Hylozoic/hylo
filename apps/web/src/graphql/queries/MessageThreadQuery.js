import gql from 'graphql-tag'

export const MessageThreadQuery = gql`
  query MessageThreadQuery ($id: ID) {
    messageThread (id: $id) {
      id
      unreadCount
      lastReadAt
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
          creator {
            id
            name
            avatarUrl
          }
          createdAt
        }
        total
        hasMore
      }
    }
  }
`

export default MessageThreadQuery
