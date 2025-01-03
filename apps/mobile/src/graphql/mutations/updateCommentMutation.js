import { gql } from 'urql'

// variables: {
//   id,
//   data: {
//     text,
//     attachments
//   }
// }

export default gql`
  mutation UpdateCommentMutation ($id: ID, $data: CommentInput) {
    updateComment(id: $id, data: $data) {
      id
      text
      attachments {
        type
        url
        position
        id
      }
    }
  }
`
