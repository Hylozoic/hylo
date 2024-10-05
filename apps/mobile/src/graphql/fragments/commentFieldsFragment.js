export default `
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
createdAt
`
