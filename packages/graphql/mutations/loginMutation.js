import { gql } from 'urql'
import meAuthFieldsFragment from '../fragments/meAuthFieldsFragment'

export default gql`
  mutation LoginMutation ($email: String, $password: String) {
    login(email: $email, password: $password) {
      me {
        ...MeAuthFieldsFragment
      }
      error
    }
    ${meAuthFieldsFragment}
  }
`
