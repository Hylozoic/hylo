import { gql } from 'urql'
import messageThreadFieldsFragment from '../fragments/messageThreadFieldsFragment'

export default gql` 
  query MessageThreadsQuery ($first: Int = 20, $offset: Int, $firstMessages: Int = 1, $search: String, $muted: Boolean) {
    me {
      id
      unseenThreadCount
      messageThreads(sortBy: "updatedAt", order: "desc", first: $first, offset: $offset, search: $search, muted: $muted) {
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
