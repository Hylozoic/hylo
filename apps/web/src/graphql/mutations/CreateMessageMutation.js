import gql from 'graphql-tag'

export const CreateMessageMutation = gql`
  mutation CreateMessageMutation (
    $messageThreadId: String,
    $text: String,
    $createdAt: Date
  ) {
    createMessage(data: {
      messageThreadId: $messageThreadId,
      text: $text,
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
