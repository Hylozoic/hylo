import { gql } from 'urql'
import postFieldsFragment from '../fragments/postFieldsFragment'

export default gql`
  query PostQuery ($id: ID) {
    post(id: $id) {
      ...PostFieldsFragment
    }
  }
  ${postFieldsFragment}
`
