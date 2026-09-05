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
  noticeData
  noticePosts {
    id
    details
    createdAt
    creator {
      id
      name
      avatarUrl
    }
  }
  creator {
    id
    name
    avatarUrl
  }
  createdAt
  clickthrough
  updatedAt
  flaggedGroups
  moderationActions {
    id
    groupId
    status
    text
    anonymous
    reporter {
      id
      name
    }
    agreements {
      id
      title
    }
    platformAgreements {
      id
      text
    }
  }
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
  commentersTotal
  commentsTotal
  ${withComments
? `commenters(first: 3) {
    id
    name
    avatarUrl
  }
  comments(first: 10, order: "desc") {
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
  meetingLink
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
    ${withComments
? `user {
      id
      name
    }`
: ''}
  }
  groups {
    id
    name
    slug
    type
    parentId
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
