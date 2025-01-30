import { gql } from 'urql'
import meAuthFieldsFragment from '@hylo/graphql/fragments/meAuthFieldsFragment'

export default gql`
  query MeCheckAuthQuery {
    me {
      ...MeAuthFieldsFragment
    }
  }
  ${meAuthFieldsFragment}
`
