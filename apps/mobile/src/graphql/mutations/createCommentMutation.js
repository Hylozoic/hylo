import { gql } from 'urql'

export const createCommentFieldsFragment = gql`
  fragment CreateCommentFieldsFragment on Comment {
    id
    text
    creator {
      id
    }
    attachments {
      id
      position
      type
      url
    }
    parentComment {
      id
    }
    myReactions {
      emojiFull
      id
    }
    commentReactions {
      emojiFull
      id
      user {
        id
        name
      }
    }
    createdAt
  }
`

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
      ...CreateCommentFieldsFragment
    }
  }
  ${createCommentFieldsFragment}
`
