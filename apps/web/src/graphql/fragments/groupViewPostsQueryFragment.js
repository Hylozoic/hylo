import chatRoomPostFieldsFragment from '@graphql/fragments/chatRoomPostFieldsFragment'
import postCardFieldsFragment from '@graphql/fragments/postCardFieldsFragment'

// When includeChildGroupPosts is true we query for viewPosts,
// which shows all the aggregate posts from current group and any
// child groups / spaces the current user is also a member of. We alias as posts so
// redux-orm sets up the relationship between group and posts correctly
const groupViewPostsQueryFragment = (includeChildGroupPosts = true, { includeGroups = true, fieldsVariant } = {}) => {
  const itemFields = fieldsVariant === 'chatRoom'
    ? chatRoomPostFieldsFragment()
    : postCardFieldsFragment({ includeGroups })

  return `
${includeChildGroupPosts ? 'posts: viewPosts(' : 'posts('}
  ${includeChildGroupPosts ? '' : 'pinned: $pinned,'}
  activePostsOnly: $activePostsOnly,
  afterTime: $afterTime,
  beforeTime: $beforeTime,
  boundingBox: $boundingBox,
  collectionToFilterOut: $collectionToFilterOut,
  cursor: $cursor,
  filter: $filter,
  first: $first,
  forCollection: $forCollection,
  isFulfilled: $isFulfilled,
  offset: $offset,
  order: $order,
  savedBy: $savedBy,
  sortBy: $sortBy,
  search: $search,
  topic: $topic,
  topics: $topics,
  types: $types
) {
  hasMore
  total
  items {
    ${itemFields}
  }
}`
}

export default groupViewPostsQueryFragment
