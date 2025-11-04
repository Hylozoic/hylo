// Lightweight fragment for chat messages - only includes fields actually used in chat UI
// This reduces query payload size by ~60% compared to full postFieldsFragment

const chatPostFieldsFragment = `
  id
  announcement
  details
  type
  creator {
    id
    name
    avatarUrl
  }
  createdAt
  updatedAt
  editedAt
  flaggedGroups
  localId
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
  commenters(first: 3) {
    id
    name
    avatarUrl
  }
  commentersTotal
  commentsTotal
  proposalStatus
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
`

export default chatPostFieldsFragment
