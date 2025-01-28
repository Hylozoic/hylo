import { gql } from 'urql'

// TODO: URQL - analytics: AnalyticsEvents.DIRECT_MESSAGE_SENT
// TODO: URQL - Look into createMessage updater which currently simply invalidates the whole thread. 
//       Doesn't work as expected with pagination when returning all fields. 
export default gql` 
  mutation CreateMessageMutation (
    $messageThreadId: String,
    $text: String
    $createdAt: Date
  ) {
    createMessage(data: {
      messageThreadId: $messageThreadId,
      text: $text
      createdAt: $createdAt
    }) {
      id
      text
      createdAt
      creator {
        id
        name
        avatarUrl
      }
      messageThread {
        id
        createdAt
        updatedAt
        messages {
          items {
            id
          }
        }
        participants {
          id
          name
          avatarUrl
        }
      }
    }
  }
`
