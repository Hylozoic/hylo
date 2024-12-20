import CommentFields from '../fragments/CommentFieldsFragment'

export default
`
query CommentsQuery (
  $id: ID,
  $cursor: ID
) {
  post(id: $id) {
    id
    comments(first: 10, cursor: $cursor, order: "desc") {
      items {
        ${CommentFields}
        childComments(first: 4, order: "desc") {
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
      total
      hasMore
    }
  }
}
`
