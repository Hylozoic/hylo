import { gql } from 'urql'

export default gql`
  mutation DeleteComment ($id: ID) {
    deleteComment(id: $id) {
      success
    }
  }
`
