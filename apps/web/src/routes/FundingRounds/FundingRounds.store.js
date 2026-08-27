import { CREATE_POST } from 'store/constants'
import CommentFieldsFragment from '@graphql/fragments/CommentFieldsFragment'
import { syncFundingRoundEmbeddedData } from 'store/util/groupViewsOrder'

export const MODULE_NAME = 'FundingRounds'
export const ALLOCATE_TOKENS_TO_SUBMISSION = `${MODULE_NAME}/ALLOCATE_TOKENS_TO_SUBMISSION`
export const ALLOCATE_TOKENS_TO_SUBMISSION_PENDING = `${MODULE_NAME}/ALLOCATE_TOKENS_TO_SUBMISSION_PENDING`
export const CREATE_FUNDING_ROUND = `${MODULE_NAME}/CREATE_FUNDING_ROUND`
export const DELETE_FUNDING_ROUND = `${MODULE_NAME}/DELETE_FUNDING_ROUND`
export const DELETE_FUNDING_ROUND_PENDING = `${MODULE_NAME}/DELETE_FUNDING_ROUND_PENDING`
export const DO_PHASE_TRANSITION = `${MODULE_NAME}/DO_PHASE_TRANSITION`
export const DO_PHASE_TRANSITION_PENDING = `${MODULE_NAME}/DO_PHASE_TRANSITION_PENDING`
export const FETCH_FUNDING_ROUND = `${MODULE_NAME}/FETCH_FUNDING_ROUND`
export const FETCH_FUNDING_ROUND_SUBMISSIONS = `${MODULE_NAME}/FETCH_FUNDING_ROUND_SUBMISSIONS`
export const FETCH_FUNDING_ROUND_PARTICIPANTS = `${MODULE_NAME}/FETCH_FUNDING_ROUND_PARTICIPANTS`
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
          allowLateJoiners
          allowSelfVoting
          canSubmit
          canVote
          createdAt
          criteria
          hideFinalResultsFromParticipants
          isParticipating
          joinedAt
          maxTokenAllocation
          minTokenAllocation
          numParticipants
          numSubmissions
          phase
          requireBudget
          submissionDescriptor
          submissionDescriptorPlural
          submitterRoles {
            id
            emoji
            name
          }
          submissionsCloseAt,
          submissionsOpenAt,
          tokenType,
          tokensRemaining,
          totalTokens,
          totalTokensAllocated,
          updatedAt,
          voterRoles {
            id
            emoji
            name
          }
          votingMethod,
          votingClosesAt,
          votingOpensAt,
          group {
            id
            name
            slug
            homeRoute
            memberCount
            parentGroup {
              id
              slug
            }
          }
        }
      }`,
      variables: { id }
    },
    meta: { extractModel: 'FundingRound' }
  }
}

export function fetchFundingRoundSubmissions (id) {
  return {
    type: FETCH_FUNDING_ROUND_SUBMISSIONS,
    graphql: {
      query: `query ($id: ID) {
        fundingRound (id: $id) {
          id
          submissions {
            items {
              ${PostFieldsFragment}
            }
          }
          allocations {
            tokensAllocated
            submission {
              id
              title
            }
            user {
              id
              name
              avatarUrl
            }
          }
        }
      }`,
      variables: { id }
    },
    meta: { extractModel: 'FundingRound' }
  }
}

export function fetchFundingRoundParticipants (id) {
  return {
    type: FETCH_FUNDING_ROUND_PARTICIPANTS,
    graphql: {
      query: `query ($id: ID) {
        fundingRound (id: $id) {
          id
          users {
            items {
              id
              avatarUrl
              name
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
    dataForMutation.submitterRoles = data.submitterRoles.map(role => ({ id: role.id }))
  }
  if (data.voterRoles) {
    dataForMutation.voterRoles = data.voterRoles.map(role => ({ id: role.id }))
  }

  return {
    type: CREATE_FUNDING_ROUND,
    graphql: {
      query: `mutation CreateFundingRound($data: FundingRoundInput) {
        createFundingRound(data: $data) {
          id,
          allowLateJoiners,
          createdAt,
          criteria,
          group {
            id
            name
            slug
            bannerUrl
            description
          }
          maxTokenAllocation,
          minTokenAllocation,
          numParticipants,
          numSubmissions,
          requireBudget,
          submissionDescriptor,
          submissionDescriptorPlural,
          submitterRoles {
            id
            emoji
            name
          }
          submissionsCloseAt,
          submissionsOpenAt,
          tokenType,
          totalTokens,
          totalTokensAllocated,
          updatedAt,
          voterRoles {
            id
            emoji
            name
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
    dataForUpdate.submitterRoles = dataForUpdate.submitterRoles.map(role => ({ id: role.id }))
  }
  if (dataForUpdate.voterRoles) {
    dataForUpdate.voterRoles = dataForUpdate.voterRoles.map(role => ({ id: role.id }))
  }
  delete dataForUpdate.phase // Only for optimistic update, backend will handle phase update

  return {
    type: UPDATE_FUNDING_ROUND,
    graphql: {
      query: `
        mutation UpdateFundingRound($id: ID, $data: FundingRoundInput) {
          updateFundingRound(id: $id, data: $data) {
            id
            phase
            tokensRemaining
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
      optimistic: true,
      extractModel: 'FundingRound'
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
            tokensRemaining
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      id,
      extractModel: 'FundingRound'
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

export function deleteFundingRound (id) {
  return {
    type: DELETE_FUNDING_ROUND,
    graphql: {
      query: `
        mutation DeleteFundingRound($id: ID) {
          deleteFundingRound(id: $id) {
            success
          }
        }
      `,
      variables: {
        id
      }
    },
    meta: {
      id,
      optimistic: true
    }
  }
}

// Determine what phase a funding round should be in based on timestamps
export function getExpectedPhase (fundingRound) {
  if (!fundingRound) return null
  if (fundingRound.phase === 'draft' || fundingRound.phase === 'archived') {
    return fundingRound.phase
  }

  const now = new Date()

  // Check phases in reverse order (most advanced to least)
  const votingClosesAt = fundingRound.votingClosesAt ? new Date(fundingRound.votingClosesAt) : null
  if (votingClosesAt && votingClosesAt <= now) return 'completed'

  const votingOpensAt = fundingRound.votingOpensAt ? new Date(fundingRound.votingOpensAt) : null
  if (votingOpensAt && votingOpensAt <= now) return 'voting'

  const submissionsCloseAt = fundingRound.submissionsCloseAt ? new Date(fundingRound.submissionsCloseAt) : null
  if (submissionsCloseAt && submissionsCloseAt <= now) return 'discussion'

  const submissionsOpenAt = fundingRound.submissionsOpenAt ? new Date(fundingRound.submissionsOpenAt) : null
  if (submissionsOpenAt && submissionsOpenAt <= now) return 'submissions'

  return fundingRound.phase || 'published'
}

// Check if a phase transition is needed
export function needsPhaseTransition (fundingRound) {
  if (!fundingRound) return false
  const expectedPhase = getExpectedPhase(fundingRound)
  return expectedPhase && expectedPhase !== fundingRound.phase
}

export function doPhaseTransition (id) {
  return {
    type: DO_PHASE_TRANSITION,
    graphql: {
      query: `
        mutation DoPhaseTransition($id: ID) {
          doPhaseTransition(id: $id) {
            id
            phase
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
  session,
  { type, meta, payload }
) {
  const { Post, FundingRound, Role } = session

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
      return round.update({ isParticipating: true, joinedAt: new Date().toISOString() })
    }

    case LEAVE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      return round.update({ isParticipating: false })
    }

    case DO_PHASE_TRANSITION_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      // Optimistically update the phase to the expected phase
      const expectedPhase = getExpectedPhase(round)
      if (expectedPhase) {
        return round.update({ phase: expectedPhase })
      }
      return round
    }

    case UPDATE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.safeGet({ id: meta.id })
      if (!round) return
      const data = { ...meta.data }
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
      round.update(data)
      // Menus read unit terms from nested linkedGroup.fundingRound blobs, not FundingRound models
      syncFundingRoundEmbeddedData(session, meta.id, {
        submissionDescriptor: data.submissionDescriptor,
        submissionDescriptorPlural: data.submissionDescriptorPlural,
        tokenType: data.tokenType,
        votingMethod: data.votingMethod,
        submissionsOpenAt: data.submissionsOpenAt,
        submissionsCloseAt: data.submissionsCloseAt,
        votingOpensAt: data.votingOpensAt,
        votingClosesAt: data.votingClosesAt
      })
      return round
    }

    case ALLOCATE_TOKENS_TO_SUBMISSION_PENDING: {
      const post = Post.safeGet({ id: meta.postId })
      if (!post) return
      const round = FundingRound.safeGet({ id: meta.fundingRoundId })
      if (!round) return
      // Add back the old allocation, then subtract the new allocation
      const oldAllocation = post.tokensAllocated || 0
      const newTokensRemaining = round.tokensRemaining + oldAllocation - meta.tokens
      round.update({ tokensRemaining: newTokensRemaining })
      return post.update({ tokensAllocated: meta.tokens })
    }

    case DELETE_FUNDING_ROUND_PENDING: {
      const round = FundingRound.withId(meta.id)
      if (round) round.delete()
      break
    }
  }
}
