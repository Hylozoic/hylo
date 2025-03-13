// TODO: do we need postMembership? depends on how pinning works. not in chat room probably
const postCardFieldsFragment = `
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
  fulfilledAt
  isAnonymousVote
  isPublic
  linkPreviewFeatured
  location
  myEventResponse
  peopleReactedTotal
  projectManagementLink
  proposalOutcome
  proposalStatus
  quorum
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
`

export default postCardFieldsFragment
