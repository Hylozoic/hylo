import { gql } from 'urql'
import messageThreadFieldsFragment from '../fragments/messageThreadFieldsFragment'

export default gql` 
  query MessageThreadsQuery ($first: Int = 20, $offset: Int, $firstMessages: Int = 1) {
    me {
      id
      unseenThreadCount
      messageThreads(sortBy: "updatedAt", order: "desc", first: $first, offset: $offset) {
        total
        hasMore
        items {
          ...MessageThreadFieldsFragment
        }
      }
    }
  }
  ${messageThreadFieldsFragment}
`
