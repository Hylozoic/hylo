import { gql } from 'urql'
import commentFieldsFragment from './commentFieldsFragment'

// Original fragment that contains all the common fields
export const postFieldsFragment = gql`
  fragment PostFieldsFragment on Post {
    id
    announcement
    title
    details
    type
    creator {
      id
      name
      avatarUrl
      groupRoles {
        items {
          id
          name
          emoji
          active
          groupId
          responsibilities {
            items {
              id
              title
              description
            }
          }
        }
      }
      membershipCommonRoles {
        items {
          id
          commonRoleId
          groupId
          userId
        }
      }
    }
    createdAt
    clickthrough
    updatedAt
    flaggedGroups
    isAnonymousVote
    isPublic
    fulfilledAt
    startTime
    endTime
    timezone
    donationsLink
    editedAt
    projectManagementLink
    myEventResponse
    commenters(first: 3) {
      id
      name
      avatarUrl
    }
    commentersTotal
    commentsTotal
    linkPreview {
      description
      id
      imageUrl
      title
      url
    }
    linkPreviewFeatured
    location
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
    peopleReactedTotal
    proposalStatus
    proposalOutcome
    votingMethod
    quorum
    proposalOptions {
      total
      hasMore
      items {
        id
        text
        emoji
      }
    }
    proposalVotes {
      total
      hasMore
      items {
        id
        optionId
        user {
          id
          name
          avatarUrl
        }
      }
    }
    myReactions {
      emojiFull
      id
    }
    postReactions {
      emojiFull
      id
      user {
        id
        name
      }
    }
    groups {
      id
      name
      slug
    }
    attachments {
      type
      url
      position
      id
    }
    topics {
      id
      name
      postsTotal
      followersTotal
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
    eventInvitations {
      total
      hasMore
      items {
        id
        response
        person {
          id
          name
          avatarUrl
          bio
          tagline
          location
        }
      }
    }
  }
`

// Fragment for posts with comments
export const postWithCommentsFragment = gql`
  fragment PostWithCommentsFragment on Post {
    ...PostFieldsFragment
    comments(first: 10, order: "desc") {
      items {
        ...CommentFieldsFragment
        childComments(first: 3, order: "desc") {
          items {
            ...CommentFieldsFragment
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
  }
  ${postFieldsFragment}
  ${commentFieldsFragment}
`

// Fragment for posts with completion data
export const postWithCompletionFragment = gql`
  fragment PostWithCompletionFragment on Post {
    ...PostFieldsFragment
    completedAt
    completionAction
    completionActionSettings
    completionResponse
  }
  ${postFieldsFragment}
`

// Fragment for posts with all completion responses
export const postWithAllCompletionResponsesFragment = gql`
  fragment PostWithAllCompletionResponsesFragment on Post {
    ...PostFieldsFragment
    completionResponses {
      items {
        id
        completedAt
        completionResponse
        user {
          id
          name
          avatarUrl
        }
      }
    }
  }
  ${postFieldsFragment}
`

// Fragment combining both comments and completion responses
export const postWithCommentsAndCompletionResponsesFragment = gql`
  fragment PostWithCommentsAndCompletionResponsesFragment on Post {
    ...PostFieldsFragment
    completedAt
    completionAction
    completionActionSettings
    completionResponse
    comments(first: 10, order: "desc") {
      items {
        ...CommentFieldsFragment
        childComments(first: 3, order: "desc") {
          items {
            ...CommentFieldsFragment
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
    completionResponses {
      items {
        id
        completedAt
        completionResponse
        user {
          id
          name
          avatarUrl
        }
      }
      total
      hasMore
    }
  }
  ${postFieldsFragment}
  ${commentFieldsFragment}
`

// Default export is the base fragment for backward compatibility
export default postFieldsFragment
