import gql from 'graphql-tag'

const MessageThreadsQuery = gql`
  query MessageThreadsQuery ($first: Int = 10, $offset: Int, $firstMessages: Int = 1, $search: String, $muted: Boolean) {
    me {
      id
      messageThreads(sortBy: "updatedAt", order: "desc", first: $first, offset: $offset, search: $search, muted: $muted) {
        total
        hasMore
        items {
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
