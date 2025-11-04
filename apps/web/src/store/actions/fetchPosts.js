import { get } from 'lodash/fp'
import chatPostFieldsFragment from '@graphql/fragments/chatPostFieldsFragment'
import groupViewPostsQueryFragment from '@graphql/fragments/groupViewPostsQueryFragment'
import postsQueryFragment from '@graphql/fragments/postsQueryFragment'
import { CONTEXT_MY, FETCH_POSTS } from 'store/constants'

export default function fetchPosts ({
  activePostsOnly,
  afterTime,
  announcementsOnly,
  beforeTime,
  childPostInclusion = 'yes',
  collectionToFilterOut,
  context,
  cursor,
  createdBy,
  filter,
  first,
  forCollection,
  interactedWithBy,
  mentionsOf,
  offset,
  order,
  savedBy,
  search,
  slug,
  sortBy,
  topic,
  topics,
  types,
  useChatFragment = false // Use lightweight fragment for chat queries (60% smaller payload)
}) {
  let query, extractModel, getItems

  if (context === 'groups') {
    query = groupQuery(childPostInclusion === 'yes', useChatFragment)
    extractModel = 'Group'
    getItems = get('payload.data.group.posts')
  } else if (context === 'all' || context === 'public' || context === CONTEXT_MY) {
    query = postsQuery
    extractModel = 'Post'
    getItems = get('payload.data.posts')
  } else {
    throw new Error(`FETCH_POSTS with context=${context} is not implemented`)
  }

  return {
    type: FETCH_POSTS,
    graphql: {
      query,
      variables: {
        activePostsOnly,
        afterTime,
        announcementsOnly,
        beforeTime,
        childPostInclusion,
        collectionToFilterOut,
        context,
        cursor,
        createdBy,
        filter,
        first: first || 20,
        forCollection,
        interactedWithBy,
        mentionsOf,
        offset,
        order,
        savedBy,
        search,
        slug,
        sortBy,
        topic,
        topics,
        types
      }
    },
    meta: {
      slug,
      extractModel,
      extractQueryResults: {
        getItems
      }
    }
  }
}

// Lightweight chat posts query fragment (60% smaller than full fragment)
const chatPostsQueryFragment = (includeChildGroupPosts = true) => `
${includeChildGroupPosts ? 'posts: viewPosts(' : 'posts('}
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
    ${chatPostFieldsFragment}
  }
}`

const groupQuery = (childPostInclusion, useChatFragment = false) => {
  const postsFragment = useChatFragment
    ? chatPostsQueryFragment(childPostInclusion)
    : groupViewPostsQueryFragment(childPostInclusion)

  return `query GroupPostsQuery (
  $activePostsOnly: Boolean,
  $afterTime: Date,
  $beforeTime: Date,
  $boundingBox: [PointInput],
  $collectionToFilterOut: ID,
  $cursor: ID,
  $filter: String,
  $first: Int,
  $forCollection: ID,
  $isFulfilled: Boolean,
  $offset: Int,
  $order: String,
  $savedBy: [ID],
  $search: String,
  $slug: String,
  $sortBy: String,
  $topic: ID,
  $topics: [ID],
  $types: [String]
) {
  group(slug: $slug, updateLastViewed: true) {
    id
    slug
    name
    avatarUrl
    bannerUrl
    ${postsFragment}
  }
}`
}

const postsQuery = `query PostsQuery (
  $activePostsOnly: Boolean,
  $afterTime: Date,
  $announcementsOnly: Boolean,
  $beforeTime: Date,
  $boundingBox: [PointInput],
  $collectionToFilterOut: ID,
  $context: String,
  $createdBy: [ID],
  $cursor: ID,
  $filter: String,
  $first: Int,
  $forCollection: ID,
  $groupSlugs: [String],
  $interactedWithBy: [ID],
  $isFulfilled: Boolean,
  $mentionsOf: [ID],
  $offset: Int,
  $order: String,
  $savedBy: [ID],
  $search: String,
  $sortBy: String,
  $topic: ID,
  $topics: [ID],
  $types: [String]
) {
  ${postsQueryFragment}
}`
