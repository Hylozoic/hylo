import { gql } from 'urql'
// Note: Imported here only to keep gql parsing from erroring-out.
// commentFieldsFragment still needs to be imported and added to the
// queries which use this fragment (for now).
import commentFieldsFragment from './commentFieldsFragment'
export const DEFAULT_INITIAL_COMMENTS = 10
export const DEFAULT_INITIAL_SUBCOMMENTS = 2

export const commentsQuerySetFieldsFragment = gql`
  fragment CommentsQuerySetFieldsFragment on Post {
    comments(
      first: ${DEFAULT_INITIAL_COMMENTS},
      cursor: $cursor,
      order: "desc"
    ) {
      items {
        ...CommentFieldsFragment
        childComments(first: ${DEFAULT_INITIAL_SUBCOMMENTS}, order: "desc") {
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
