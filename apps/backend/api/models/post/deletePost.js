import {
  POST_TYPE_TO_TYPED_VIEW,
  postCountsTowardChatUnread
} from '@hylo/shared'

// Decrement GroupViewUser unread when a post is deleted, then sync membership badges.
// Called as a background job after a post is deactivated.
export async function decrementNewPostCount (post) {
  const { groups } = post.relations

  if (!groups || groups.length === 0) {
    return
  }

  const postType = post.get('type')
  const typedViewType = POST_TYPE_TO_TYPED_VIEW[postType]

  const viewDecrements = Promise.map(groups.models, async group => {
    const jobs = []

    // Typed common views (discussions, events, …)
    if (typedViewType) {
      const typedView = await GroupView.where({
        group_id: group.id,
        type: typedViewType
      }).fetch()
      if (typedView) {
        jobs.push(GroupViewUser.decrementNewPostCount(typedView.id, { beforePostId: post.id }))
      }
    }

    // Chat view badge: chat posts only
    if (postCountsTowardChatUnread(postType)) {
      const chatView = await GroupView.where({
        group_id: group.id,
        type: GroupView.Type.CHAT
      }).fetch()
      if (chatView) {
        jobs.push(GroupViewUser.decrementNewPostCount(chatView.id, { beforePostId: post.id }))
      }
    }

    return Promise.all(jobs)
  })

  await viewDecrements
  return Promise.all(groups.models.map(group => GroupMembership.syncBadgeCounts(group.id)))
}
