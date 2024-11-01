import { FETCH_POSTS } from 'store/constants'
import postsQueryFragment from 'graphql/fragments/postsQueryFragment'
import groupViewPostsQueryFragment from 'graphql/fragments/groupViewPostsQueryFragment'

export default function fetchPosts ({
  activePostsOnly,
  afterTime,
  announcementsOnly,
  beforeTime,
  childPostInclusion = 'yes',
  collectionToFilterOut,
  context,
  createdBy,
  cursor,
  filter,
  first,
  forCollection,
  interactedWithBy,
  mentionsOf,
  myHome,
  offset,
  order,
  search,
  slug,
  sortBy,
  topic,
  topics,
  types
}) {
  let query

  if (context === 'groups') {
    query = groupQuery(childPostInclusion === 'yes')
  } else if (context === 'all' || context === 'public' || context === 'my') {
    query = postsQuery
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
        createdBy,
        cursor,
        filter,
        first: first || 20,
        forCollection,
        interactedWithBy,
        mentionsOf,
        offset,
        order,
        search,
        slug,
        sortBy,
        topic,
        topics,
        types
      }
    }
  }
}

const groupQuery = childPostInclusion => `query GroupPostsQuery (
  $activePostsOnly: Boolean,
  $afterTime: Date,
  $beforeTime: Date,
  $boundingBox: [PointInput],
  $collectionToFilterOut: ID,
  $filter: String,
  $first: Int,
  $forCollection: ID,
  $isFulfilled: Boolean,
  $offset: Int,
  $order: String,
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
    locationObject {
      center {
        lat
        lng
      }
    }
    avatarUrl
    bannerUrl
    postCount
    ${groupViewPostsQueryFragment(childPostInclusion)}
  }
}`

const postsQuery = `query PostsQuery (
  $activePostsOnly: Boolean,
  $afterTime: Date,
  $announcementsOnly: Boolean,
  $beforeTime: Date,
  $boundingBox: [PointInput],
  $collectionToFilterOut: ID,
  $context: String,
  $createdBy: [ID],
  $filter: String,
  $first: Int,
  $forCollection: ID,
  $groupSlugs: [String],
  $interactedWithBy: [ID],
  $isFulfilled: Boolean,
  $mentionsOf: [ID],
  $offset: Int,
  $order: String,
  $search: String,
  $sortBy: String,
  $topic: ID,
  $topics: [ID],
  $types: [String]
) {
  ${postsQueryFragment}
}`
