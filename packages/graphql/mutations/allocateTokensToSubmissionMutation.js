import { gql } from 'urql'

export default gql`
  mutation AllocateTokensToSubmission($postId: ID, $tokens: Int) {
    allocateTokensToSubmission(postId: $postId, tokens: $tokens) {
      id
      tokensAllocated
      fundingRound {
        id
        tokensRemaining
      }
    }
  }
`
