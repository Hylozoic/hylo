import { get } from 'lodash/fp'
import groupViewPostsQueryFragment from '@graphql/fragments/groupViewPostsQueryFragment'
import postsQueryFragment from '@graphql/fragments/postsQueryFragment'
import { CONTEXT_MY, FETCH_POSTS } from 'store/constants'

export default function fetchPosts ({
  activePostsOnly,
  afterTime,
  announcementsOnly,
  beforeTime,
  childPostInclusion = 'yes',
  includePostGroups = true,
  collectionToFilterOut,
  context,
  cursor,
  createdBy,
  filter,
  first,
  forCollection,
  groupId,
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
  fieldsVariant
}) {
  let query, extractModel, getItems

  if (context === 'groups') {
    query = groupQuery(childPostInclusion === 'yes', { includeGroups: includePostGroups, fieldsVariant })
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
      groupId,
      extractModel,
      extractQueryResults: {
        getItems,
        getRouteParams: ({ meta }) => {
          const params = { ...meta.graphql.variables }
          if (meta.groupId) params.groupId = meta.groupId
          return params
        }
      }
    }
  }
}

const groupQuery = (childPostInclusion, { includeGroups = true, fieldsVariant } = {}) => `query GroupPostsQuery (
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
    ${groupViewPostsQueryFragment(childPostInclusion, { includeGroups, fieldsVariant })}
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
