// Just what the profile cards (avatar hover card, DM ProfileCardDialog) show, so opening
// one stays cheap. Same groupRoles shape as personQuery so the Person model stays consistent.
// canMessage: whether the viewer may DM this person (same rule as the new-message recipient search).
export default
`query PersonHoverCard ($id: ID) {
  person (id: $id) {
    id
    name
    avatarUrl
    bannerUrl
    tagline
    location
    bio
    canMessage
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
