import gql from 'graphql-tag'

const CreateCommentMutation = gql`
  mutation CreateCommentMutation (
    $postId: String,
    $parentCommentId: String,
    $text: String,
    $attachments: [AttachmentInput],
  ) {
    createComment(data: {
      postId: $postId,
      parentCommentId: $parentCommentId,
      text: $text,
      attachments: $attachments,
    }) {
      id
      text
      post {
        id
      }
      creator {
        id
      }
      attachments {
        type
        url
        position
        id
      }
      parentComment {
        id
      }
      createdAt
    }
  }
`

export default CreateCommentMutation
