import { gql } from 'urql'

export default gql` 
  query MessageThreadMessagesQuery ($id: ID, $cursor: ID, $first: Int = 20) {
    messageThread (id: $id) {
      id
      unreadCount
      lastReadAt
      createdAt
      updatedAt
      messages(first: $first, cursor: $cursor, order: "desc") {
        hasMore
        total
        items {
          createdAt
          id
          text
          creator {
            id
            name
            avatarUrl
          }
        }
      }
      participants {
        avatarUrl
        id
        name
      }
    }
  }
`
