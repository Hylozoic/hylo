import { gql } from 'urql'

export default gql`
  mutation ProcessStripTokenMutation ($postId: ID, $token: String, $amount: Int) {
    processStripeToken (postId: $postId, token: $token, amount: $amount) {
      success
    }
  }
`
