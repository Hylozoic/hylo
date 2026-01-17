export const FETCH_FUNDING_ROUND_ALLOCATIONS = 'FundingRounds/FETCH_FUNDING_ROUND_ALLOCATIONS'

export default function fetchFundingRoundAllocations (id) {
  return {
    type: FETCH_FUNDING_ROUND_ALLOCATIONS,
    graphql: {
      query: `query ($id: ID) {
        fundingRound(id: $id) {
          allocations {
            tokensAllocated
            submission {
              id
              title
            }
            user {
              id
              name
            }
          }
        }
      }`,
      variables: { id }
    }
  }
}
