import { gql } from '@urql/core'

export const unsavePostMutation = gql`
  mutation UnsavePost($postId: ID!) {
    unsavePost(postId: $postId) {
      id
    }
  }
`

export default unsavePostMutation
