import { gql } from 'urql'
import meAuthFieldsFragment from 'frontend-shared/graphql/fragments/meAuthFieldsFragment'

export default gql`
  query MeCheckAuthQuery {
    me {
      ...MeAuthFieldsFragment
    }
  }
  ${meAuthFieldsFragment}
`
