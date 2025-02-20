import { gql } from 'urql'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'
import postsQuerySetFragment from '@hylo/graphql/fragments/postsQuerySetFragment'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'

export const STREAM_PAGE_SIZE = 10

export const makeStreamQuery = ({
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
  first = STREAM_PAGE_SIZE,
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
}) => {
  return {
    query: (context === 'public' || context === 'all')
      ? postsQuery
      : makeGroupPostsQuery(childPostInclusion === 'yes'),
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
      first,
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

const postsQuery = gql`
  query StreamPostsQuery (
    $announcementsOnly: Boolean,
    $context: String,
    $createdBy: [ID],
    $groupSlugs: [String],
    $interactedWithBy: [ID],
    $mentionsOf: [ID],
    # following vars are in common between postsQuery and groupPostsQuery
    $activePostsOnly: Boolean,
    $afterTime: Date,
    $beforeTime: Date,
    $boundingBox: [PointInput],
    $collectionToFilterOut: ID,
    $filter: String,
    $first: Int = ${STREAM_PAGE_SIZE},
    $forCollection: ID,
    $isFulfilled: Boolean,
    $offset: Int = 0,
    $order: String,
    $search: String,
    $sortBy: String,
    $topic: ID,
    $topics: [ID],
    $types: [String]
  ) {
    ...PostsQuerySetFragment
  }
  ${postsQuerySetFragment}
`

// TODO: URQL - eliminate Group.viewPosts and add "includeChildPost" filter (or similar)
// viewPosts shows all the aggregate posts from current group and any
// children the current user is a member of. We aliased as posts so
// redux-orm would setup the relationship between group and posts correctly
const makeGroupPostsQuery = withChildPosts => gql`
  query StreamGroupPostsQuery (
    $slug: String,
    # following vars are in common between postsQuery and groupPostsQuery
    $activePostsOnly: Boolean,
    $afterTime: Date,
    $beforeTime: Date,
    $boundingBox: [PointInput],
    $collectionToFilterOut: ID,
    $filter: String,
    $first: Int = ${STREAM_PAGE_SIZE},
    $forCollection: ID,
    $isFulfilled: Boolean,
    $offset: Int = 0,
    $order: String,
    $search: String,
    $sortBy: String,
    $topic: ID,
    $topics: [ID],
    $types: [String]
  ) {
    group(slug: $slug, updateLastViewed: true) {
      id
      postCount
      ${withChildPosts ? 'posts: viewPosts' : 'posts'}(
        activePostsOnly: $activePostsOnly,
        afterTime: $afterTime,
        beforeTime: $beforeTime,
        boundingBox: $boundingBox,
        collectionToFilterOut: $collectionToFilterOut,
        filter: $filter,
        first: $first,
        forCollection: $forCollection,
        isFulfilled: $isFulfilled,
        offset: $offset,
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
          ...PostFieldsFragment
        }
      }
    }
  }
  ${postFieldsFragment}
`

export default makeStreamQuery
