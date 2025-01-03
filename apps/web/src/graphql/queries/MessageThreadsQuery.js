import gql from 'graphql-tag'

const MessageThreadsQuery = gql`
  query MessageThreadsQuery ($first: Int = 10, $offset: Int, $firstMessages: Int = 1) {
    me {
      id
      messageThreads(sortBy: "updatedAt", order: "desc", first: $first, offset: $offset) {
        total
        hasMore
        items {
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
      }
    }
  }
`

export default MessageThreadsQuery
