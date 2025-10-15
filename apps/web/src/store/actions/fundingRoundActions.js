import CommentFieldsFragment from '@graphql/fragments/CommentFieldsFragment'

export const MODULE_NAME = 'FundingRounds'
export const ALLOCATE_TOKENS_TO_SUBMISSION = `${MODULE_NAME}/ALLOCATE_TOKENS_TO_SUBMISSION`
export const ALLOCATE_TOKENS_TO_SUBMISSION_PENDING = `${MODULE_NAME}/ALLOCATE_TOKENS_TO_SUBMISSION_PENDING`
export const CREATE_FUNDING_ROUND = `${MODULE_NAME}/CREATE_FUNDING_ROUND`
export const DISTRIBUTE_FUNDING_ROUND_TOKENS = `${MODULE_NAME}/DISTRIBUTE_FUNDING_ROUND_TOKENS`
export const DISTRIBUTE_FUNDING_ROUND_TOKENS_PENDING = `${MODULE_NAME}/DISTRIBUTE_FUNDING_ROUND_TOKENS_PENDING`
export const FETCH_FUNDING_ROUND = `${MODULE_NAME}/FETCH_FUNDING_ROUND`
export const JOIN_FUNDING_ROUND = `${MODULE_NAME}/JOIN_FUNDING_ROUND`
export const JOIN_FUNDING_ROUND_PENDING = `${MODULE_NAME}/JOIN_FUNDING_ROUND_PENDING`
export const LEAVE_FUNDING_ROUND = `${MODULE_NAME}/LEAVE_FUNDING_ROUND`
export const LEAVE_FUNDING_ROUND_PENDING = `${MODULE_NAME}/LEAVE_FUNDING_ROUND_PENDING`
export const UPDATE_FUNDING_ROUND = `${MODULE_NAME}/UPDATE_FUNDING_ROUND`
export const UPDATE_FUNDING_ROUND_PENDING = `${MODULE_NAME}/UPDATE_FUNDING_ROUND_PENDING`

const PostFieldsFragment = `
  id
  commentersTotal
  commentsTotal
  createdAt
  details
  linkPreviewFeatured
  location
  peopleReactedTotal
  title
  tokensAllocated
  totalTokensAllocated
  type
  updatedAt
  attachments {
    type
    url
    position
    id
  }
  comments(first: 10, order: "desc") {
    items {
      ${CommentFieldsFragment}
      childComments(first: 3, order: "desc") {
        items {
          ${CommentFieldsFragment}
          post {
            id
          }
        }
        total
        hasMore
      }
    }
    total
    hasMore
  }
  creator {
    id
    name
    avatarUrl
    tagline
  }
  flaggedGroups
  linkPreview {
    description
    id
    imageUrl
    title
    url
  }
  locationObject {
    id
    addressNumber
    addressStreet
    bbox {
      lat
      lng
    }
    center {
      lat
      lng
    }
    city
    country
    fullText
    locality
    neighborhood
    region
  }
  postReactions {
    emojiFull
    id
    user {
      id
      name
    }
  }
  topics {
    id
    name
  }
  members {
    total
    hasMore
    items {
      id
      name
      avatarUrl
      bio
      tagline
      location
    }
  }
`

export function fetchFundingRound (id) {
  return {
    type: FETCH_FUNDING_ROUND,
    graphql: {
      query: `query ($id: ID) {
        fundingRound (id: $id) {
          id
          bannerUrl
          createdAt,
          criteria,
          description,
          group { id name slug }
          isParticipating
          maxTokenAllocation,
          minTokenAllocation,
          numParticipants,
          numSubmissions,
          publishedAt,
          requireBudget,
          submissionDescriptor,
          submissionDescriptorPlural,
          submissions {
            items {
              ${PostFieldsFragment}
            }
          }
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
          tokensDistributedAt,
          tokensRemaining,
          totalTokens,
          totalTokensAllocated,
          updatedAt,
          users {
            items {
              id
              avatarUrl
              name
            }
          }
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
      variables: { id }
    },
    meta: { extractModel: 'FundingRound' }
  }
}

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
          bannerUrl,
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
          numParticipants,
          numSubmissions,
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
          totalTokensAllocated,
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

export function updateFundingRound (data) {
  const { id, ...rest } = data

  // We need the full roles in the data for the optimistic update, but only the role id in the mutation
  const dataForUpdate = { ...rest }
  if (dataForUpdate.submitterRole) {
    dataForUpdate.submitterRoleId = rest.submitterRole.id
  }
  if (dataForUpdate.voterRole) {
    dataForUpdate.voterRoleId = rest.voterRole.id
  }
  delete dataForUpdate.submitterRole // outside the if in case completionRole is null
  delete dataForUpdate.voterRole // outside the if in case completionRole is null

  return {
    type: UPDATE_FUNDING_ROUND,
    graphql: {
      query: `
        mutation UpdateFundingRound($id: ID, $data: FundingRoundInput) {
          updateFundingRound(id: $id, data: $data) {
            id
          }
        }
      `,
      variables: {
        id,
        data: dataForUpdate
      }
    },
    meta: {
      id,
      data: rest,
      optimistic: true
    }
  }
}

export function joinFundingRound (id) {
  return {
    type: JOIN_FUNDING_ROUND,
    graphql: {
      query: `
        mutation JoinFundingRound($id: ID) {
          joinFundingRound(id: $id) {
            id
            isParticipating
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      id
    }
  }
}

export function leaveFundingRound (id) {
  return {
    type: LEAVE_FUNDING_ROUND,
    graphql: {
      query: `
        mutation LeaveFundingRound($id: ID) {
          leaveFundingRound(id: $id) {
            id
            isParticipating
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      id
    }
  }
}

export function distributeFundingRoundTokens (id) {
  return {
    type: DISTRIBUTE_FUNDING_ROUND_TOKENS,
    graphql: {
      query: `
        mutation DistributeFundingRoundTokens($id: ID) {
          distributeFundingRoundTokens(id: $id) {
            id
            tokensDistributedAt
            tokensRemaining
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      id
    }
  }
}

export function allocateTokensToSubmission (postId, tokens, fundingRoundId) {
  return {
    type: ALLOCATE_TOKENS_TO_SUBMISSION,
    graphql: {
      query: `
        mutation AllocateTokensToSubmission($postId: ID, $tokens: Int) {
          allocateTokensToSubmission(postId: $postId, tokens: $tokens) {
            id
            tokensAllocated
          }
        }
      `,
      variables: {
        postId,
        tokens
      }
    },
    meta: {
      postId,
      tokens,
      fundingRoundId,
      optimistic: true
    }
  }
}
