import fetchTopicFollow from './fetchTopicFollow'
import fetchPosts from './fetchPosts'

// Dispatches topicFollow and posts queries in parallel to eliminate waterfall
// This saves ~300-500ms compared to sequential useEffect loading
export default function fetchChatRoomInit ({
  groupId,
  groupSlug,
  topicName,
  initialPostsToLoad = 12,
  context = 'groups',
  search = ''
}) {
  return async (dispatch) => {
    // Dispatch both queries in parallel (single network roundtrip via GraphQL batching if enabled)
    const [topicFollowAction, postsAction] = await Promise.all([
      dispatch(fetchTopicFollow(groupId, topicName)),
      dispatch(fetchPosts({
        childPostInclusion: 'no',
        context,
        cursor: undefined, // Will be set after topicFollow loads
        filter: 'chat',
        first: initialPostsToLoad,
        order: 'desc',
        slug: groupSlug,
        search,
        sortBy: 'id',
        topicName, // Use topicName parameter (new backend support)
        useChatFragment: true
      }))
    ])

    const topicFollow = topicFollowAction.payload?.data?.topicFollow
    const posts = postsAction.payload?.data?.group?.posts

    return {
      topicFollow,
      posts
    }
  }
}
