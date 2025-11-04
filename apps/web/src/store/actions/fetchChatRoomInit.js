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
    // Step 1: Fetch topicFollow to get lastReadPostId and newPostCount
    const topicFollowAction = await dispatch(fetchTopicFollow(groupId, topicName))
    const topicFollow = topicFollowAction.payload?.data?.topicFollow

    if (!topicFollow) {
      return { topicFollow: null, posts: null }
    }

    // Step 2: Fetch both past and future posts in parallel with correct cursors
    const lastReadPostId = topicFollow.lastReadPostId
    const newPostCount = topicFollow.newPostCount || 0

    const [pastPostsAction, futurePostsAction] = await Promise.all([
      // Fetch past posts (before lastReadPostId)
      dispatch(fetchPosts({
        childPostInclusion: 'no',
        context,
        cursor: lastReadPostId ? parseInt(lastReadPostId) + 1 : undefined,
        filter: 'chat',
        first: Math.max(initialPostsToLoad - newPostCount, 3),
        order: 'desc',
        slug: groupSlug,
        search,
        sortBy: 'id',
        topicName,
        useChatFragment: true
      })),
      // Fetch future posts (after lastReadPostId) if there are any
      newPostCount > 0 ? dispatch(fetchPosts({
        childPostInclusion: 'no',
        context,
        cursor: lastReadPostId || undefined,
        filter: 'chat',
        first: Math.min(initialPostsToLoad, newPostCount),
        order: 'asc',
        slug: groupSlug,
        search,
        sortBy: 'id',
        topicName,
        useChatFragment: true
      })) : Promise.resolve(null)
    ])

    return {
      topicFollow,
      pastPosts: pastPostsAction.payload?.data?.group?.posts,
      futurePosts: futurePostsAction?.payload?.data?.group?.posts
    }
  }
}
