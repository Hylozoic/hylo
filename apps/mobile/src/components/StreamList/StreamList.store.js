import { gql } from 'urql'
import postsQueryFragment from 'graphql/fragments/postsQueryFragment'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

export const makeQuery = ({
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
}) => {
  let query

  if (context === 'groups') {
    query = groupPostsQuery(childPostInclusion === 'yes')
  } else if (context === 'all' || context === 'public' || context === 'my') {
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

const postsQuery = gql`
  query PostsQuery (
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
    $first: Int,
    $forCollection: ID,
    $isFulfilled: Boolean,
    $offset: Int,
    $order: String,
    $search: String,
    $sortBy: String,
    $topic: ID,
    $topics: [ID],
    $types: [String]
  ) {
    ...PostsQueryFragment    
    ${postsQueryFragment}
  }
`

// TODO: URQL - eliminate Group.viewPosts and add "includeChildPost" filter (or similar)
// viewPosts shows all the aggregate posts from current group and any
// children the current user is a member of. We alias as posts so
// redux-orm sets up the relationship between group and posts correctly
const groupPostsQuery = withChildPosts => gql`
  query GroupPostsQuery (
    $slug: String,
    # following vars are in common between postsQuery and groupPostsQuery
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
    ${postFieldsFragment}
  }
`
