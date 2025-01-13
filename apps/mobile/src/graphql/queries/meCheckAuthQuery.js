import { gql } from 'urql'
import meAuthFieldsFragment from 'graphql/fragments/meAuthFieldsFragment'

export default gql`
  query MeCheckAuthQuery {
    me {
      ...MeAuthFieldsFragment
    }
  }
  ${meAuthFieldsFragment}
`
