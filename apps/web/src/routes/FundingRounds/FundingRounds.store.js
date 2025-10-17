import { CREATE_POST } from 'store/constants'
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
  budget
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
  groups {
    id
    name
    slug
  }
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
          canSubmit
          canVote
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
          submitterRoles {
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
              membershipCommonRoles {
                items {
                  id
                  commonRoleId
                  groupId
                  userId
                }
              }
              groupRoles {
                items {
                  id
                  name
                  emoji
                  active
                  groupId
                }
              }
            }
          }
          voterRoles {
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
  // Convert role objects to the format expected by the API (array of {id, type})
  const dataForMutation = { ...data }
  if (data.submitterRoles) {
    dataForMutation.submitterRoles = data.submitterRoles.map(role => ({ id: role.id, type: role.type }))
  }
  if (data.voterRoles) {
    dataForMutation.voterRoles = data.voterRoles.map(role => ({ id: role.id, type: role.type }))
  }

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
          submitterRoles {
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
          voterRoles {
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
      variables: { data: dataForMutation }
    },
    meta: {
      extractModel: 'FundingRound'
    }
  }
}

export function updateFundingRound (data) {
  const { id, ...rest } = data

  // Convert role objects to the format expected by the API (array of {id, type})
  const dataForUpdate = { ...rest }
  if (dataForUpdate.submitterRoles) {
    dataForUpdate.submitterRoles = dataForUpdate.submitterRoles.map(role => ({ id: role.id, type: role.type }))
  }
  if (dataForUpdate.voterRoles) {
    dataForUpdate.voterRoles = dataForUpdate.voterRoles.map(role => ({ id: role.id, type: role.type }))
  }

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

export function ormSessionReducer (
  { Post, FundingRound, Role, session },
  { type, meta, payload }
) {
  switch (type) {
    case CREATE_POST: {
      if (!meta.fundingRoundId || !payload.data.createPost) return
      const round = FundingRound.safeGet({ id: meta.fundingRoundId })
      if (!round) return
      // Only add submission-type posts to the submissions list
      if (meta.type === 'submission') {
        round.update({
          numSubmissions: round.numSubmissions + 1
        })
        round.updateAppending({
          submissions: [payload.data.createPost.id]
        })
      }
      return round
    }

    case JOIN_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      return round.update({ isParticipating: true })
    }

    case LEAVE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      return round.update({ isParticipating: false })
    }

    case UPDATE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      const data = meta.data
      if (data.submitterRoles) {
        data.submitterRoles = data.submitterRoles.map(roleData => {
          let role = Role.withId(roleData?.id)
          if (!role) {
            role = Role.create(roleData)
          }
          return role.id
        })
      }
      if (data.voterRoles) {
        data.voterRoles = data.voterRoles.map(roleData => {
          let role = Role.withId(roleData?.id)
          if (!role) {
            role = Role.create(roleData)
          }
          return role.id
        })
      }
      return round.update(data)
    }
  }
}
