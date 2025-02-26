import { gql } from 'urql'

export default gql`
  mutation SendEmailVerificationMutation ($email: String!) {
    sendEmailVerification(email: $email) {
      success
      error
    }
  }
`
