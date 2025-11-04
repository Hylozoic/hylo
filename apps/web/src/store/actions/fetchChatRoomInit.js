import fetchTopicFollow from './fetchTopicFollow'
import fetchPosts from './fetchPosts'

export default function fetchChatRoomInit ({
  groupId,
  groupSlug,
  topicName,
  initialPostsToLoad = 12,
  context = 'groups',
  search = ''
}) {
  return async (dispatch) => {
    // Dispatch both queries in parallel with consistent topicName parameter
    // This eliminates the waterfall delay while maintaining cache key consistency
    const [topicFollowAction, postsAction] = await Promise.all([
      dispatch(fetchTopicFollow(groupId, topicName)),
      dispatch(fetchPosts({
        childPostInclusion: 'no',
        context,
        cursor: undefined,
        filter: 'chat',
        first: initialPostsToLoad,
        order: 'desc',
        slug: groupSlug,
        search,
        sortBy: 'id',
        topicName,  // Use topicName parameter (NOT topic ID) for cache key consistency
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
