import gql from 'graphql-tag'

export const MessageThreadMessagesQuery = gql`
  query MessageThreadMessagesQuery ($id: ID, $cursor: ID) {
    messageThread (id: $id) {
      id
      messages(first: 80, cursor: $cursor, order: "desc") {
        items {
          id
          text
          createdAt
          editedAt
          postReactions {
            emojiFull
            id
            user {
              id
              name
            }
          }
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
        total
        hasMore
      }
    }
  }
`

export default MessageThreadMessagesQuery
