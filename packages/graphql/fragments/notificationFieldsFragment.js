import { gql } from 'urql'

export default gql`
  fragment NotificationFieldsFragment on Notification {
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
`
