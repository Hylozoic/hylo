import { gql } from 'urql'
import meAuthFieldsFragment from '../fragments/meAuthFieldsFragment'

export default gql`
  query MeCheckAuthQuery {
    me {
      ...MeAuthFieldsFragment
    }
  }
  ${meAuthFieldsFragment}
`
