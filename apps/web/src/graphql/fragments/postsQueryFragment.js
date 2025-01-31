import postCardFieldsFragment from '@graphql/fragments/postCardFieldsFragment'

const postsQueryFragment = `
posts(
  activePostsOnly: $activePostsOnly,
  afterTime: $afterTime,
  announcementsOnly: $announcementsOnly,
  beforeTime: $beforeTime,
  boundingBox: $boundingBox,
  collectionToFilterOut: $collectionToFilterOut,
  createdBy: $createdBy,
  cursor: $cursor,
  filter: $filter,
  first: $first,
  forCollection: $forCollection,
  groupSlugs: $groupSlugs,
  interactedWithBy: $interactedWithBy,
  mentionsOf: $mentionsOf,
  isFulfilled: $isFulfilled,
  offset: $offset,
  context: $context,
  order: $order,
  sortBy: $sortBy,
  search: $search,
  topic: $topic,
  topics: $topics,
  types: $types
) {
  hasMore
  total
  items {
    ${postCardFieldsFragment}
  }
}`

export default postsQueryFragment
