import { gql } from 'urql'
import { isContextGroup } from 'frontend-shared/presenters/GroupPresenter'
import postsQuerySetFragment from 'frontend-shared/graphql/fragments/postsQuerySetFragment'
import postFieldsFragment from 'frontend-shared/graphql/fragments/postFieldsFragment'

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
  myHome,
  offset,
  order,
  search,
  slug,
  sortBy,
  topic,
  topics,
  types
}) => {
  let query

  if (context === 'groups') {
    query = makeGroupPostsQuery(childPostInclusion === 'yes')
  // TODO: URQL - Amend to make 'my' a ContextGroup as well
  } else if (isContextGroup(context)) {
    query = postsQuery
  } else {
    throw new Error(`makeQuery with context=${context} is not implemented`)
  }

  return {
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
// children the current user is a member of. We alias as posts so
// redux-orm sets up the relationship between group and posts correctly
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
