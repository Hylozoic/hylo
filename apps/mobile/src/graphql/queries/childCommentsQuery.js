import { gql } from 'urql'
import commentFieldsFragment from 'graphql/fragments/commentFieldsFragment'

export default gql`
query ChildCommentsQuery (
  $commentId: ID,
  $cursor: ID
) {
  comment(id: $commentId) {
    id
    childComments(first: 10, cursor: $cursor, order: "desc") {
      items {
        ${commentFieldsFragment}
        post {
          id
        }
      }
      total
      hasMore
    }
  }
}
`
