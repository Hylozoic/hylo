import { gql } from 'urql'
import postFieldsFragment from 'frontend-shared/graphql/fragments/postFieldsFragment'

export default gql`
  query PostQuery ($id: ID) {
    post(id: $id) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`
