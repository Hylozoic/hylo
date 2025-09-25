export const MODULE_NAME = 'FundingRounds'
export const CREATE_FUNDING_ROUND = `${MODULE_NAME}/CREATE_FUNDING_ROUND`
export const FETCH_FUNDING_ROUND = `${MODULE_NAME}/FETCH_FUNDING_ROUND`

export function createFundingRound (data) {
  // We need the full role in the data for the optimistic update, but only the id in the mutation
  data = { ...data, submitterRoleId: data.submitterRole?.id, voterRoleId: data.voterRole?.id }
  delete data.submitterRole
  delete data.voterRole

  return {
    type: CREATE_FUNDING_ROUND,
    graphql: {
      query: `mutation CreateFundingRound($data: FundingRoundInput) {
        createFundingRound(data: $data) {
          id,
          createdAt,
          criteria,
          description,
          group {
            id
            name
            slug
          }
          maxTokenAllocation,
          minTokenAllocation,
          publishedAt,
          requireBudget,
          submissionDescriptor,
          submissionDescriptorPlural,
          submitterRole {
            ... on CommonRole {
              id
              emoji
              name
            }
            ... on GroupRole {
              id
              emoji
              name
            }
          }
          submissionsCloseAt,
          submissionsOpenAt,
          title,
          tokenType,
          totalTokens,
          updatedAt,
          voterRole {
            ... on CommonRole {
              id
              emoji
              name
            }
            ... on GroupRole {
              id
              emoji
              name
            }
          }
          votingMethod,
          votingClosesAt,
          votingOpensAt
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
          createdAt,
          criteria,
          description,
          maxTokenAllocation,
          minTokenAllocation,
          publishedAt,
          requireBudget,
          submissionDescriptor,
          submissionDescriptorPlural,
          submitterRole {
            ... on CommonRole {
              id
              emoji
              name
            }
            ... on GroupRole {
              id
              emoji
              name
            }
          }
          submissionsCloseAt,
          submissionsOpenAt,
          title,
          tokenType,
          totalTokens,
          updatedAt,
          voterRole {
            ... on CommonRole {
              id
              emoji
              name
            }
            ... on GroupRole {
              id
              emoji
              name
            }
          }
          votingMethod,
          votingClosesAt,
          votingOpensAt
          group { id name slug }
        }
      }`,
      variables: { id }
    },
    meta: { extractModel: 'FundingRound' }
  }
}
