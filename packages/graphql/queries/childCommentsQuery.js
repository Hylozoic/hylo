import { gql } from 'urql'
import commentFieldsFragment from '../fragments/commentFieldsFragment'

export default gql`
  query ChildCommentsQuery (
    $commentId: ID,
    $cursor: ID,
    $first: Int = 10
  ) {
    comment(id: $commentId) {
      id
      childComments(first: $first, cursor: $cursor, order: "desc") {
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
