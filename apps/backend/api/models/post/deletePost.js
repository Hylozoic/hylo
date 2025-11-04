// Decrement new_post_count for TagFollows when a post is deleted
// This is called as a background job after a post is deactivated
export async function decrementNewPostCount (post) {
  const { tags, groups } = post.relations

  if (!tags || tags.length === 0 || !groups || groups.length === 0) {
    return
  }

  // Find all TagFollows that:
  // 1. Have a tag_id matching one of the post's tags
  // 2. Have a group_id matching one of the post's groups
  // 3. Have a last_read_post_id less than the deleted post's id (meaning they haven't seen this post yet)
  // 4. Decrement their new_post_count (but not below 0)
  const tagFollowQuery = TagFollow.query(q => {
    q.whereIn('tag_id', tags.map('id'))
    q.whereIn('group_id', groups.map('id'))
    q.where('last_read_post_id', '<', post.id)
    q.where('new_post_count', '>', 0)
  }).query()

  // Also decrement for GroupMemberships
  const groupMembershipQuery = GroupMembership.query(q => {
    q.whereIn('group_id', groups.map('id'))
    q.where('group_memberships.active', true)
    q.where('group_memberships.new_post_count', '>', 0)
  }).query()

  return Promise.all([
    tagFollowQuery.decrement('new_post_count'),
    groupMembershipQuery.decrement('new_post_count')
  ])
}
