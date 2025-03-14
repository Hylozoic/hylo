import { gql } from 'urql'

export default gql`
  mutation DeleteCommentMutation ($id: ID) {
    deleteComment(id: $id) {
      success
    }
  }
`
