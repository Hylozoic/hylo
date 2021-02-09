import { getPostFieldsFragment } from './fetchPost'
import { get } from 'lodash/fp'

export const FETCH_POSTS = 'FETCH_POSTS'

export default function fetchPosts (
  { subject, slug, sortBy, offset, search, filter, topic },
  { reset } = {},
  // fetchProjects uses this action generator but provides a different type
  type = FETCH_POSTS
) {
  let query, extractModel, getItems, projectFilter

  if (subject === 'group') {
    query = groupQuery
    extractModel = 'Group'
    getItems = get('payload.data.group.posts')
  } else if (subject === 'project') {
    query = groupQuery
    extractModel = 'Group'
    getItems = get('payload.data.group.posts')
    projectFilter = 'project'
  } else {
    throw new Error(`FETCH_POSTS with subject=${subject} is not implemented`)
  }

  return {
    type,
    graphql: {
      query,
      variables: {
        slug,
        sortBy,
        offset,
        search,
        filter: projectFilter || filter,
        first: 20,
        topic
      }
    },
    meta: {
      afterInteractions: true,
      extractModel,
      extractQueryResults: {
        getItems,
        reset
      }
    }
  }
}

export const postsQueryFragment = `
posts(
  first: $first,
  offset: $offset,
  sortBy: $sortBy,
  search: $search,
  filter: $filter,
  topic: $topic,
  order: "desc"
) {
  hasMore
  items {
    ${getPostFieldsFragment(false)}
  }
}`

const groupQuery = `query (
  $slug: String,
  $sortBy: String,
  $offset: Int,
  $search: String,
  $filter: String,
  $topic: ID,
  $first: Int
) {
  group(slug: $slug, updateLastViewed: true) {
    id
    slug
    name
    avatarUrl
    bannerUrl
    postCount
    ${postsQueryFragment}
  }
}`

const allGroupsQuery = `query (
  $sortBy: String,
  $offset: Int,
  $search: String,
  $filter: String,
  $topic: ID,
  $first: Int
) {
  ${postsQueryFragment}
}`
