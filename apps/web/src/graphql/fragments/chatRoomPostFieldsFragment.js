/** GraphQL fields for chat room lists — chat messages plus minimal post notices. */
export default function chatRoomPostFieldsFragment () {
  return `
  id
  clickthrough
  commentersTotal
  commentsTotal
  createdAt
  details
  editedAt
  endTime
  flaggedGroups
  linkPreviewFeatured
  postMemberships {
    id
    pinned
    group {
      id
    }
  }
  savedAt
  startTime
  timezone
  title
  type
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
  linkPreview {
    description
    id
    imageUrl
    title
    url
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
