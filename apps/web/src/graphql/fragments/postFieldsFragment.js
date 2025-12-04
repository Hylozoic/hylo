import { INITIAL_SUBCOMMENTS_DISPLAYED } from 'util/constants'

// :TODO: clean this up and use proper query fragments?
const CommentFieldsFragment = `
  id
  text
  creator {
    id
    name
    avatarUrl
  }
  attachments {
    id
    position
    type
    url
  }
  parentComment {
    id
  }
  commentReactions {
    emojiFull
    id
    user {
      id
      name
    }
  }
  createdAt
  editedAt
`

const postFieldsFragment = (withComments, withCompletion = false, withAllCompletionResponses = false) => `
  id
  announcement
  budget
  title
  details
  type
  creator {
    id
    name
    avatarUrl
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
  savedAt
  commenters(first: 3) {
    id
    name
    avatarUrl
  }
  commentersTotal
  commentsTotal
  ${withComments
? `comments(first: 10, order: "desc") {
    items {
      ${CommentFieldsFragment}
      childComments(first: ${INITIAL_SUBCOMMENTS_DISPLAYED}, order: "desc") {
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
  }`
: ''}
  ${withCompletion
? `completedAt
   completionAction
   completionActionSettings
   completionResponse`
: ''}
  ${withAllCompletionResponses
? `completionResponses {
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
  }`
  : ''}
  linkPreview {
    description
    id
    imageUrl
    title
    url
  }
  linkPreviewFeatured
  localId
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
`

export default postFieldsFragment
