import { gql } from 'urql'

export const NOTIFICATIONS_PAGE_SIZE = 20

export default gql`
query notificationsQuery ($first: Int, $offset: Int) {
  notifications (first: $first, offset: $offset, order: "desc") {
    total
    hasMore
    items {
      id
      createdAt
      activity {
        id
        actor {
          id
          name
          avatarUrl
        }
        comment {
          id
          text
        }
        post {
          id
          title
          details
          groups {
            id
            slug
          }  
        }
        group {
          id
          name
          slug
        }
        meta {
          reasons
        }
        action
        unread
      }
    }
  }
}
`
