import { gql } from 'urql'

export default gql`
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
      creator {
        id
      }
      parentComment {
        id
      }
      attachments {
        type
        url
        position
        id
      }
      createdAt
    }
  }
`
