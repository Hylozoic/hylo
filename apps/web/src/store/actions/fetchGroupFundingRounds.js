import { get } from 'lodash/fp'

export const FETCH_GROUP_FUNDING_ROUNDS = 'FETCH_GROUP_FUNDING_ROUNDS'

const query = `
query (
  $id: ID,
  $first: Int,
  $offset: Int,
  $order: String,
  $sortBy: String,
) {
  group (id: $id) {
    id
    fundingRounds (first: $first, offset: $offset, order: $order, sortBy: $sortBy) {
      items {
        id
        title
        description
        criteria
        requireBudget
        votingMethod
        tokenType
        totalTokens
        minTokenAllocation
        maxTokenAllocation
        createdAt
        updatedAt
      }
    }
  }
}
`

export default function fetchGroupFundingRounds (groupId, {
  first = 20,
  offset = 0,
  order = 'desc',
  sortBy = 'created_at'
} = {}) {
  return {
    type: FETCH_GROUP_FUNDING_ROUNDS,
    graphql: {
      query,
      variables: {
        id: groupId,
        first,
        offset,
        order,
        sortBy
      }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.fundingRounds')
      }
    }
  }
}
