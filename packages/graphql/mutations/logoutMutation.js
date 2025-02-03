import { gql } from 'urql'

export default gql`
  mutation LogoutMutation {
    logout {
      success
      error
    }
  }
`
