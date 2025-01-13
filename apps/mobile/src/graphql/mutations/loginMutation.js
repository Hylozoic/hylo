import { gql } from 'urql'
import meAuthFieldsFragment from 'graphql/fragments/meAuthFieldsFragment'

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
