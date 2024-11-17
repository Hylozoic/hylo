import CommentFields from '../fragments/CommentFieldsFragment'

export default
`
query SubCommentsQuery (
  $id: ID,
  $cursor: ID
) {
  comment(id: $id) {
    id
    childComments(first: 10, cursor: $cursor, order: "desc") {
      items {
        ${CommentFields}
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
