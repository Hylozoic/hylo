import { gql } from 'urql'
import commentFieldsFragment from 'frontend-shared/graphql/fragments/commentFieldsFragment'

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
      ...CommentFieldsFragment
      childComments(first: 2, order: "desc") {
        items {
          ...CommentFieldsFragment
        }
        total
        hasMore
      }
    }  
  }
  ${commentFieldsFragment}
`
