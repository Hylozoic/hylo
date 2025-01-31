import { gql } from 'urql'

export default gql`
  mutation RecordClickthroughMutation ($postId: ID) {
    recordClickthrough (postId: $postId) {
      success
    }
  }
`
