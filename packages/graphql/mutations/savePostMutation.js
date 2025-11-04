import { gql } from '@urql/core'

export const savePostMutation = gql`
  mutation SavePost($postId: ID!) {
    savePost(postId: $postId) {
      id
    }
  }
`

export default savePostMutation
