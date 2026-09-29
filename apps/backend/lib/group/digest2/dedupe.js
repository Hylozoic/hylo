/* global bookshelf, Notification */
// D39: a digest is what the member missed, not a full recap. Before a digest goes to
// someone, the post sections leave out every post they already got by email or have
// already read, and "Active Conversations" leaves out comments older than their last
// read of that post.
//
// The "Open requests" section (openRequests.js) is a deliberate exception (D58): it may
// show an unmet request again, so it is never filtered here.
//
// All three lookups run as one query per recipient, so a digest run adds a single
// round trip per person and stays within DIGEST_USER_CONCURRENCY's connection budget.

// Post sections that skip what the member already has
export const DEDUPED_POST_KEYS = [
  'discussions',
  'requests',
  'offers',
  'events',
  'projects',
  'resources',
  'proposals'
]

const idsOf = items => (items || [])
  .map(item => item?.id)
  .filter(id => id != null)
  .map(id => String(id))

/**
 * Which of these posts and comments the user has already seen.
 * - emailedPostIds: a post notification (not a comment one) was emailed to them
 * - readPostIds: they opened the post after it was created
 * - seenCommentIds: the comment is no newer than their last read of its post
 * @returns {Promise<{ emailedPostIds: Set<string>, readPostIds: Set<string>, seenCommentIds: Set<string> }>}
 */
export async function seenContentFor (userId, { postIds = [], commentIds = [] } = {}) {
  const result = { emailedPostIds: new Set(), readPostIds: new Set(), seenCommentIds: new Set() }
  if (!userId || (postIds.length === 0 && commentIds.length === 0)) return result

  const { rows } = await bookshelf.knex.raw(`
    SELECT 'emailed' AS kind, a.post_id AS id
    FROM activities a
    JOIN notifications n ON n.activity_id = a.id
    WHERE a.post_id = ANY(?::bigint[])
      AND a.reader_id = ?
      AND a.comment_id IS NULL
      AND n.medium = ?
      AND n.sent_at IS NOT NULL
    UNION
    SELECT 'read' AS kind, pu.post_id AS id
    FROM posts_users pu
    JOIN posts p ON p.id = pu.post_id
    WHERE pu.post_id = ANY(?::bigint[])
      AND pu.user_id = ?
      AND pu.last_read_at IS NOT NULL
      AND pu.last_read_at >= p.created_at
    UNION
    SELECT 'comment' AS kind, c.id AS id
    FROM comments c
    JOIN posts_users pu ON pu.post_id = c.post_id AND pu.user_id = ?
    WHERE c.id = ANY(?::bigint[])
      AND pu.last_read_at IS NOT NULL
      AND c.created_at <= pu.last_read_at
  `, [postIds, userId, Notification.MEDIUM.Email, postIds, userId, userId, commentIds])

  for (const row of rows) {
    const id = String(row.id)
    if (row.kind === 'emailed') result.emailedPostIds.add(id)
    else if (row.kind === 'read') result.readPostIds.add(id)
    else if (row.kind === 'comment') result.seenCommentIds.add(id)
  }
  return result
}

/**
 * Removes what the user has already seen from a (cloned) digest payload, in place.
 * Posts with new comments keep only the comments newer than the user's last read;
 * a post left with none is dropped, and comment_count follows what is left.
 * @returns {Promise<object>} the same data object
 */
export async function dropSeenContent (userId, data) {
  const postIds = [...new Set(DEDUPED_POST_KEYS.flatMap(key => idsOf(data[key])))]
  const commentIds = [...new Set((data.posts_with_new_comments || []).flatMap(post => idsOf(post.comments)))]
  const seen = await seenContentFor(userId, { postIds, commentIds })

  const isSeenPost = post => post?.id != null &&
    (seen.emailedPostIds.has(String(post.id)) || seen.readPostIds.has(String(post.id)))

  for (const key of DEDUPED_POST_KEYS) {
    if (!data[key]) continue
    data[key] = data[key].filter(post => !isSeenPost(post))
  }

  if (data.posts_with_new_comments) {
    data.posts_with_new_comments = data.posts_with_new_comments
      .map(post => {
        const comments = (post.comments || []).filter(comment => !seen.seenCommentIds.has(String(comment?.id)))
        return { ...post, comments, comment_count: comments.length }
      })
      .filter(post => post.comments.length > 0)
  }

  return data
}
