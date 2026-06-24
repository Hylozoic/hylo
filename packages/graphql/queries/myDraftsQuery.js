import { gql } from '@urql/core'
import draftFieldsFragment from '../fragments/draftFieldsFragment'

export const myDraftsQuery = gql`
  query MyDrafts {
    myDrafts {
      ...DraftFieldsFragment
    }
  }
  ${draftFieldsFragment}
`

export default myDraftsQuery
