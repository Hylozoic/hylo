/**
 * Whether a chat item should render its day bar.
 * The first loaded row is mid-history while older pages exist — giving it a
 * bar means same-day prepends remove it, the item shrinks, and the list jumps.
 */
export const chatShowsDayLabel = ({ prevCreatedAt, sameDayAsPrevious, hasMorePast }) => {
  if (prevCreatedAt) return !sameDayAsPrevious
  return hasMorePast !== true
}

/**
 * True when two post ids refer to the same post (GraphQL ids are strings; sockets may send numbers).
 */
export const samePostId = (a, b) => a != null && b != null && String(a) === String(b)

/**
 * True when a list item can be stored as group_views_users.last_read_post_id.
 * Pending / sentinel / non-numeric ids violate the posts FK.
 */
export const isPersistedChatPostId = (post) => {
  if (!post || post.pending || post.id == null) return false
  const id = parseInt(post.id, 10)
  return Number.isFinite(id) && id > 0 && id < Number.MAX_SAFE_INTEGER
}

/**
 * Past/future page for the chat list. Always a full page — never sized by
 * newPostCount. That count is often 0 for the author or after a stale mark-read,
 * and using it as `first` skipped every post after lastRead (different users
 * then saw different tails of the same room).
 * Missing lastRead: past has no cursor (latest page desc); future uses a
 * sentinel so it does not load the oldest posts in the room.
 */
export function chatRoomPageParams (baseParams, { startId, order, first }) {
  const parsed = startId != null ? parseInt(startId, 10) : NaN
  const hasCursor = Number.isFinite(parsed)
  if (order === 'desc') {
    return {
      ...baseParams,
      ...(hasCursor ? { cursor: parsed + 1 } : {}),
      first,
      order: 'desc'
    }
  }
  return {
    ...baseParams,
    cursor: hasCursor ? startId : String(Number.MAX_SAFE_INTEGER),
    first,
    order: 'asc'
  }
}

/**
 * List index to show after load (posts sorted by id ascending).
 * Lands on the last-read post so the "New posts" divider sits just below it
 * (one past post visible above the line). Does not jump to the newest post.
 */
export const computeChatInitialScrollIndex = (sortedPosts, postIdToStartAt, lastReadPostId) => {
  if (!sortedPosts?.length) return 0

  // Set initial scroll to the passed in post to scroll to, otherwise to the last read post
  const postToScrollTo = postIdToStartAt || lastReadPostId
  if (!postToScrollTo) return 0

  // Join-room hack: lastRead is past any loaded id — they are already at the latest.
  const lastId = sortedPosts[sortedPosts.length - 1].id
  if (Number(postToScrollTo) > Number(lastId)) return sortedPosts.length - 1

  const lastReadIndex = sortedPosts.findIndex(post => samePostId(post.id, postToScrollTo))
  if (lastReadIndex !== -1) return lastReadIndex

  // lastRead is not in this window: sit on the post just before the first newer one.
  const firstNewerIndex = sortedPosts.findIndex(post => Number(post.id) > Number(postToScrollTo))
  if (firstNewerIndex > 0) return firstNewerIndex - 1
  if (firstNewerIndex === 0) return 0

  return sortedPosts.length - 1
}
