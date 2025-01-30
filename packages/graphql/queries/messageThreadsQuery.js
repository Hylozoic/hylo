import { gql } from 'urql'
import messageThreadFieldsFragment from '@hylo/graphql/fragments/messageThreadFieldsFragment'

export default gql` 
  query MessageThreadsQuery ($first: Int = 10, $offset: Int, $firstMessages: Int = 1) {
    me {
      id
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
