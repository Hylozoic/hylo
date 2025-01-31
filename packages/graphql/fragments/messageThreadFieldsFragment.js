import { gql } from 'urql'

export default gql` 
  fragment MessageThreadFieldsFragment on MessageThread {
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
    messages(first: $firstMessages, order: "desc") {
      items {
        id
        createdAt
        text
        creator {
          id
          name
        }
      }
    }
  }
`
