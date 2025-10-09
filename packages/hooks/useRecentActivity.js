import { useMemo } from 'react'
import { useQuery } from 'urql'
import recentActivityQuery from '@hylo/graphql/queries/recentActivityQuery'

/**
 * Utility function to check if an item is a post
 * @param {Object} item - Activity item to check
 * @returns {boolean} - True if item is a post
 */
export const isPost = (item) => {
  return item && item.title !== undefined && !item.post
}

/**
 * Utility function to check if an item is a comment
 * @param {Object} item - Activity item to check
 * @returns {boolean} - True if item is a comment
 */
export const isComment = (item) => {
  return item && item.text !== undefined && item.post
}

/**
 * Utility function to check if an item is a reaction
 * @param {Object} item - Activity item to check
 * @returns {boolean} - True if item is a reaction
 */
export const isReaction = (item) => {
  return item && item.emojiBase !== undefined && item.post
}

/**
 * Combine and sort posts, comments, and reactions chronologically
 * @param {Array} posts - Array of posts
 * @param {Array} comments - Array of comments
 * @param {Array} reactions - Array of reactions
 * @returns {Array} - Combined and sorted array
 */
function combineActivityItems (posts = [], comments = [], reactions = []) {
  return [...posts, ...comments, ...reactions]
    .sort((a, b) => {
      const aDate = new Date(a.createdAt)
      const bDate = new Date(b.createdAt)
      return bDate - aDate // Descending order (newest first)
    })
}

/**
 * Hook to fetch and manage recent activity (posts, comments, and reactions) for a person
 * @param {Object} params - Query parameters
 * @param {string} params.id - Person ID
 * @param {number} params.first - Number of items to fetch (default: 10)
 * @param {string} params.order - Sort order (default: 'desc')
 * @param {Object} useQueryArgs - Additional urql useQuery arguments
 * @returns {Array} [activityItems, { fetching, error, hasMorePosts, hasMoreComments, hasMoreReactions }, reQuery]
 */
export default function useRecentActivity ({
  id,
  first = 10,
  order = 'desc',
  // Support for additional query parameters
  activePostsOnly,
  afterTime,
  announcementsOnly,
  beforeTime,
  boundingBox,
  collectionToFilterOut,
  context,
  createdBy,
  filter,
  forCollection,
  groupSlugs,
  interactedWithBy,
  isFulfilled,
  mentionsOf,
  offset,
  savedBy,
  search,
  sortBy,
  topic,
  topics,
  types
}, useQueryArgs = {}) {
  const [result, reQuery] = useQuery({
    query: recentActivityQuery,
    variables: {
      id,
      first,
      order,
      activePostsOnly,
      afterTime,
      announcementsOnly,
      beforeTime,
      boundingBox,
      collectionToFilterOut,
      context,
      createdBy,
      filter,
      forCollection,
      groupSlugs,
      interactedWithBy,
      isFulfilled,
      mentionsOf,
      offset,
      savedBy,
      search,
      sortBy,
      topic,
      topics,
      types
    },
    ...useQueryArgs
  })

  const { activityItems, hasMorePosts, hasMoreComments, hasMoreReactions } = useMemo(() => {
    if (!result.data?.person) return { activityItems: [], hasMorePosts: false, hasMoreComments: false, hasMoreReactions: false }

    const posts = result.data.person.posts?.items || []
    const comments = result.data.person.comments?.items || []
    const reactions = result.data.person.reactions?.items || []

    const hasMorePosts = result.data.person.posts?.hasMore || false
    const hasMoreComments = result.data.person.comments?.hasMore || false
    const hasMoreReactions = result.data.person.reactions?.hasMore || false

    const activityItems = combineActivityItems(posts, comments, reactions)

    return { activityItems, hasMorePosts, hasMoreComments, hasMoreReactions }
  }, [result.data])

  return [
    activityItems,
    {
      fetching: result.fetching,
      error: result.error,
      hasMorePosts,
      hasMoreComments,
      hasMoreReactions
    },
    reQuery
  ]
}
