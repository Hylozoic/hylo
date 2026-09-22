import gql from 'graphql-tag'

export const CreateMessageMutation = gql`
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
      id
      text
      createdAt
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

export default CreateMessageMutation
