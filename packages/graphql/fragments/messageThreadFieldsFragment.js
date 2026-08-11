import { gql } from 'urql'

export default gql` 
  fragment MessageThreadFieldsFragment on MessageThread {
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
    messages(first: $firstMessages, order: "desc") {
      items {
        id
        createdAt
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
      }
    }
  }
`
