import { gql } from '@urql/core'

export const deleteDraftMutation = gql`
  mutation DeleteDraft($id: ID!) {
    deleteDraft(id: $id) {
      success
    }
  }
`

export default deleteDraftMutation
