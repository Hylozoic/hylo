import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

const postsQueryFragment = `
posts(
  activePostsOnly: $activePostsOnly,
  afterTime: $afterTime,
  announcementsOnly: $announcementsOnly,
  beforeTime: $beforeTime,
  boundingBox: $boundingBox,
  collectionToFilterOut: $collectionToFilterOut,
  createdBy: $createdBy,
  filter: $filter,
  first: $first,
  forCollection: $forCollection,
  groupSlugs: $groupSlugs,
  isFulfilled: $isFulfilled,
  interactedWithBy: $interactedWithBy,
  mentionsOf: $mentionsOf,
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
    ${postFieldsFragment(false)}
  }
}`

export default postsQueryFragment
