// Just what the avatar hover card shows, so opening it stays cheap.
// Same groupRoles shape as personQuery so the Person model stays consistent.
export default
`query PersonHoverCard ($id: ID) {
  person (id: $id) {
    id
    name
    avatarUrl
    bannerUrl
    tagline
    messageThreadId
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
  }
}`
