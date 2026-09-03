const postGroupsFields = `
  groups {
    id
    name
    slug
    type
    parentId
  }
`

export default function postCardFieldsFragment ({ includeGroups = true } = {}) {
  return `
  id
  announcement
  clickthrough
  commentersTotal
  commentsTotal
  createdAt
  details
  donationsLink
  editedAt
  endTime
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
  fulfilledAt
  isAnonymousVote
  isPublic
  linkPreviewFeatured
  location
  meetingLink
  myEventResponse
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
  peopleReactedTotal
  projectManagementLink
  proposalOutcome
  proposalStatus
  quorum
  savedAt
  startTime
  timezone
  title
  type
  updatedAt
  votingMethod
  attachments {
    type
    url
    position
    id
  }
  commenters(first: 3) {
    id
    name
    avatarUrl
  }
  creator {
    id
    name
    avatarUrl
  }
  ${includeGroups ? postGroupsFields : ''}
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
  linkPreview {
    description
    id
    imageUrl
    title
    url
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
`
}
