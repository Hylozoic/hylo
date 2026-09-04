import { gql } from 'urql'

// This mutation uses makeAppendToPaginatedSetResolver in the updates to add new messages
// to the messages list without overwriting existing messages. The messageThread data
// provides participant info needed for ThreadCard display without interfering with message pagination.

export default gql` 
  mutation CreateMessageMutation (
    $messageThreadId: String,
    $text: String,
    $attachments: [AttachmentInput],
    $createdAt: Date
  ) {
    createMessage(data: {
      messageThreadId: $messageThreadId,
      text: $text,
      attachments: $attachments,
      createdAt: $createdAt
    }) {
      createdAt
      id
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
      messageThread {
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
      }
    }
  }
`
