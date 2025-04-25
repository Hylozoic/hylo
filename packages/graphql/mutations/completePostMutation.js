import { gql } from 'urql'

export default gql`
  mutation CompletePostMutation($postId: ID, $completionResponse: JSON) {
    completePost(postId: $postId, completionResponse: $completionResponse) {
      success
    }
  }
`
