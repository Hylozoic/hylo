import { useQuery } from 'urql'
import { useMemo } from 'react'
import chatPostsQuery from '@hylo/graphql/queries/chatPostsQuery'

/**
 * Hook to fetch and manage chat posts with bidirectional pagination
 * @param {Object} params - Query parameters
 * @param {string} params.groupSlug - Group slug
 * @param {string} params.topicId - Topic ID
 * @param {number} params.first - Number of posts to fetch (default: 20)
 * @param {string} params.search - Search term
 * @param {string} params.cursor - Cursor for pagination
 * @param {string} params.order - Sort order ('asc' or 'desc')
 * @param {Object} useQueryArgs - Additional urql useQuery arguments
 * @returns {Object} { posts, hasMore, fetching, error, reQuery }
 */
export default function useChatPosts ({
  groupSlug,
  topicId,
  first = 20,
  search,
  cursor,
  order = 'desc',
  debugNoFilter = false // TODO: Remove after debugging
}, useQueryArgs = {}) {
  const variables = useMemo(() => ({
    cursor,
    filter: debugNoFilter ? null : 'chat', // TODO: Try removing this filter temporarily for debugging
    first,
    order,
    slug: groupSlug,
    search,
    sortBy: 'id',
    topic: topicId
  }), [
    cursor,
    debugNoFilter,
    first,
    groupSlug,
    order,
    search,
    topicId
  ])

  const [result, reQuery] = useQuery({
    query: chatPostsQuery,
    variables,
    pause: !groupSlug || !topicId,
    ...useQueryArgs
  })

  // Debug logging
  console.log('useChatPosts Debug:', {
    variables,
    paused: !groupSlug || !topicId,
    fetching: result.fetching,
    error: result.error,
    dataKeys: result.data ? Object.keys(result.data) : null,
    groupData: result.data?.group ? {
      id: result.data.group.id,
      name: result.data.group.name,
      postsCount: result.data.group.posts?.items?.length || 0,
      hasMore: result.data.group.posts?.hasMore
    } : null
  })

  const posts = useMemo(() => {
    return result.data?.group?.posts?.items || []
  }, [result.data])

  const hasMore = useMemo(() => {
    return result.data?.group?.posts?.hasMore || false
  }, [result.data])

  return {
    posts,
    hasMore,
    fetching: result.fetching,
    error: result.error,
    reQuery
  }
}

/**
 * Helper hook for creating past posts query parameters
 * @param {Object} params - Base parameters
 * @param {string} params.groupSlug - Group slug
 * @param {string} params.topicId - Topic ID
 * @param {string} params.lastReadPostId - Last read post ID for cursor
 * @param {string} params.postIdToStartAt - Specific post ID to start at
 * @returns {Object} Parameters for fetching past posts
 */
export function useChatPostsPastParams ({
  groupSlug,
  topicId,
  first = 20,
  search,
  lastReadPostId,
  postIdToStartAt
}) {
  return useMemo(() => ({
    groupSlug,
    topicId,
    first,
    search,
    cursor: postIdToStartAt 
      ? parseInt(postIdToStartAt) + 1 
      : parseInt(lastReadPostId) + 1,
    order: 'desc'
  }), [
    groupSlug,
    topicId,
    first,
    search,
    postIdToStartAt,
    lastReadPostId
  ])
}

/**
 * Helper hook for creating future posts query parameters
 * @param {Object} params - Base parameters
 * @param {string} params.groupSlug - Group slug
 * @param {string} params.topicId - Topic ID
 * @param {string} params.lastReadPostId - Last read post ID for cursor
 * @param {string} params.postIdToStartAt - Specific post ID to start at
 * @returns {Object} Parameters for fetching future posts
 */
export function useChatPostsFutureParams ({
  groupSlug,
  topicId,
  first = 20,
  search,
  lastReadPostId,
  postIdToStartAt
}) {
  return useMemo(() => ({
    groupSlug,
    topicId,
    first,
    search,
    cursor: postIdToStartAt || lastReadPostId,
    order: 'asc'
  }), [
    groupSlug,
    topicId,
    first,
    search,
    postIdToStartAt,
    lastReadPostId
  ])
} 