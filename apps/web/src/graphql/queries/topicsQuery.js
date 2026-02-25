export default `query FetchTopics (
  $groupSlug: String,
  $groupIds: [ID],
  $autocomplete: String,
  $isDefault: Boolean,
  $visibility: [Int],
  $first: Int,
  $offset: Int,
  $sortBy: String
) {
  topics (
    groupSlug: $groupSlug,
    groupIds: $groupIds,
    autocomplete: $autocomplete,
    isDefault: $isDefault,
    visibility: $visibility,
    first: $first,
    offset: $offset,
    sortBy: $sortBy,
  ) {
    hasMore
    total
    items {
      id
      name
      postsTotal(
        groupSlug: $groupSlug
      )
      followersTotal(
        groupSlug: $groupSlug
      )
      groupTopics(isDefault: $isDefault, visibility: $visibility) {
        items {
          id
          followersTotal
          isDefault
          isSubscribed
          postsTotal
          visibility
          group {
            id
            name
            avatarUrl
          }
        }
      }
    }
  }
}`
