export default
`
  id
  text
  creator {
    id
    name
    avatarUrl
  }
  myReactions {
    emojiFull
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
  attachments {
    id
    position
    type
    url
  }
  parentComment {
    id
  }
  createdAt
  editedAt
`
