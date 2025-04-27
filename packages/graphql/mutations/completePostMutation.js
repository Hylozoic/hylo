import { gql } from '@urql/core'

export const completePostMutation = gql`
  mutation CompletePost($postId: ID!, $completionResponse: JSON!) {
    completePost(postId: $postId, completionResponse: $completionResponse) {
      id
      title
      details
      completedAt
      completionResponse
      completionAction
      completionActionSettings
    }
  }
`

export default completePostMutation
