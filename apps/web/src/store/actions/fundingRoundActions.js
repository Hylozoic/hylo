export const MODULE_NAME = 'FundingRounds'
export const CREATE_FUNDING_ROUND = `${MODULE_NAME}/CREATE_FUNDING_ROUND`
export const FETCH_FUNDING_ROUND = `${MODULE_NAME}/FETCH_FUNDING_ROUND`

export function createFundingRound (data) {
  return {
    type: CREATE_FUNDING_ROUND,
    graphql: {
      query: `mutation CreateFundingRound($data: FundingRoundInput) {
        createFundingRound(data: $data) {
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
          group {
            id
            name
            slug
          }
        }
      }`,
      variables: { data }
    },
    meta: {
      extractModel: 'FundingRound'
    }
  }
}

export function fetchFundingRound (id) {
  return {
    type: FETCH_FUNDING_ROUND,
    graphql: {
      query: `query ($id: ID) {
        fundingRound (id: $id) {
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
          group { id name slug }
        }
      }`,
      variables: { id }
    },
    meta: { extractModel: 'FundingRound' }
  }
}
