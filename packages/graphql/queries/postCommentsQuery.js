import { gql } from 'urql'
import commentFieldsFragment from '../fragments/commentFieldsFragment'

export default gql`
  query PostCommentsQuery (
    $postId: ID,
    $cursor: ID,
    $first: Int = 10
  ) {
    post(id: $postId) {
      id
      comments(first: $first, cursor: $cursor, order: "desc") {
        items {
          ...CommentFieldsFragment
          childComments(first: 2, order: "desc") {
            items {
              ...CommentFieldsFragment
            }
            total
            hasMore
          }
        }
        total
        hasMore
      }
    }
  }
  ${commentFieldsFragment}
`
