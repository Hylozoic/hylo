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
      track {
        id
        name
      }
      meta {
        reasons
      }
      action
      unread
    }
  }
`
