import { gql } from 'urql'

// Note: Must be used in conjunction with graphql/fragments/commentFieldsFragment.js
export const commentsQuerySetFieldsFragment = gql`
  fragment CommentsQuerySetFieldsFragment on Post {
    comments(
      first: 10,
      cursor: $cursor,
      order: "desc"
    ) {
      items {
        ...CommentFieldsFragment
        childComments(first: 2, order: "desc") {
          items {
            ...CommentFieldsFragment
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
`

export default commentsQuerySetFieldsFragment
