import { gql } from 'urql'
import messageThreadFieldsFragment from '../fragments/messageThreadFieldsFragment'

export default gql` 
  mutation FindOrCreateThreadMutation ($participantIds: [String], $firstMessages: Int = 1) {
    findOrCreateThread(data: {
      participantIds: $participantIds
    }) {
      ...MessageThreadFieldsFragment
    }
  }
  ${messageThreadFieldsFragment}
`
