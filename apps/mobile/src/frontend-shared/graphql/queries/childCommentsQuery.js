import { gql } from 'urql'
import commentFieldsFragment from 'frontend-shared/graphql/fragments/commentFieldsFragment'

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
