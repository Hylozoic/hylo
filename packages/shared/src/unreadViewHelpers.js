/**
 * Post-type ↔ view-type helpers for unread badges.
 * Chat-visible types match Search util type=chat / ChatRoom filter.
 */

export const CHAT_VISIBLE_POST_TYPES = [
  'chat',
  'discussion',
  'request',
  'offer',
  'project',
  'proposal',
  'event',
  'resource'
]

/** Typed common views that show an orange unread dot (not numbered). */
export const TYPED_BADGE_VIEW_TYPES = [
  'discussions',
  'events',
  'projects',
  'proposals',
  'resources',
  'requests-and-offers'
]

/** View types that never show unread badges. */
export const NO_BADGE_VIEW_TYPES = [
  'all',
  'custom',
  'collection',
  'welcome',
  'map',
  'members',
  'about',
  'link',
  'text',
  'space',
  'moderation',
  'related-groups',
  'track-actions',
  'funding-round-submissions',
  'group',
  'member'
]

/** Maps a post type to its typed GroupView type (offer+request share one view). */
export const POST_TYPE_TO_TYPED_VIEW = {
  discussion: 'discussions',
  event: 'events',
  offer: 'requests-and-offers',
  request: 'requests-and-offers',
  resource: 'resources',
  proposal: 'proposals',
  project: 'projects'
}

/** Alias used on web (same map as POST_TYPE_TO_TYPED_VIEW). */
export const POST_TYPE_TO_VIEW_TYPE = POST_TYPE_TO_TYPED_VIEW

/** Inverse: view type → post types counted for that badge. */
export const TYPED_VIEW_TO_POST_TYPES = Object.entries(POST_TYPE_TO_TYPED_VIEW).reduce((acc, [postType, viewType]) => {
  acc[viewType] = [...(acc[viewType] || []), postType]
  return acc
}, {})

/** Alias used on web (same map as TYPED_VIEW_TO_POST_TYPES). */
export const VIEW_TYPE_TO_POST_TYPES = TYPED_VIEW_TO_POST_TYPES

/**
 * Whether a new post should increment the chat unread count for a group.
 * - notices on (default): chat + discussion/request/offer/… (CHAT_VISIBLE_POST_TYPES)
 * - notices off: chat posts only
 */
export function postCountsTowardChatUnread (postType, showPostNoticesInChat = true) {
  if (showPostNoticesInChat) return CHAT_VISIBLE_POST_TYPES.includes(postType)
  return postType === 'chat'
}

/** Post types to use when recounting chat unread for a group. */
export function chatRecountPostTypes (showPostNoticesInChat = true) {
  return showPostNoticesInChat ? CHAT_VISIBLE_POST_TYPES : ['chat']
}

/**
 * Post types that should be counted toward new_post_count for a view.
 * Returns null when the view never tracks unread (caller should set count to 0).
 */
export function recountPostTypesForView (viewType, showPostNoticesInChat = true) {
  if (viewType === 'chat') return chatRecountPostTypes(showPostNoticesInChat)
  if (TYPED_VIEW_TO_POST_TYPES[viewType]) return TYPED_VIEW_TO_POST_TYPES[viewType]
  return null
}
