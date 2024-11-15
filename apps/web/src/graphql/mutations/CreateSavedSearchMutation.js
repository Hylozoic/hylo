export default
`
mutation CreateSavedSearchMutation(
  $boundingBox: [PointInput],
  $groupSlug: String,
  $context: String,
  $name: String,
  $postTypes: [String],
  $searchText: String,
  $topicIds: [ID],
  $userId: ID
) {
  createSavedSearch(data: {
    boundingBox: $boundingBox,
    groupSlug: $groupSlug,
    context: $context,
    name: $name,
    postTypes: $postTypes,
    searchText: $searchText,
    topicIds: $topicIds,
    userId: $userId
  }) {
    id
    name
    boundingBox
    createdAt
    context
    group {
      name
      slug
    }
    isActive
    searchText
    topics {
      id
      name
    }
    postTypes
  }
}
`
