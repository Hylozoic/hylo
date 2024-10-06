import { gql } from 'urql'
import commentFieldsFragment from 'graphql/fragments/commentFieldsFragment'

export const DEFAULT_INITIAL_COMMENTS = 10
export const DEFAULT_INITIAL_SUBCOMMENTS = 2

export default gql`
query CommentsQuery (
  $postId: ID,
  $cursor: ID
) {
  post(id: $postId) {
    id
    comments(first: ${DEFAULT_INITIAL_COMMENTS}, cursor: $cursor, order: "desc") {
      items {
        ${commentFieldsFragment}
        childComments(first: ${DEFAULT_INITIAL_SUBCOMMENTS}, order: "desc") {
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
      total
      hasMore
    }
  }
}
`
