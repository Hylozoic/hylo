/**
 * Unread badge helpers for GroupViews menus.
 * Chat is the only numbered badge; typed common views get a dot; all/custom/etc. never badge.
 */

import { TYPED_BADGE_VIEW_TYPES as TYPED_BADGE_VIEW_TYPES_LIST } from '@hylo/shared'

export const TYPED_BADGE_VIEW_TYPES = new Set(TYPED_BADGE_VIEW_TYPES_LIST)

/**
 * Whether this view type shows any unread indicator in the menu.
 */
export function viewShowsUnreadBadge (view) {
  if (!view?.type) return false
  if (view.type === 'chat') return (view.newPostCount || 0) > 0
  if (TYPED_BADGE_VIEW_TYPES.has(view.type)) return (view.newPostCount || 0) > 0
  return false
}

/**
 * Numbered badge count for chat only; null for dots / no badge.
 */
export function viewUnreadBadgeCount (view) {
  if (view?.type === 'chat' && (view.newPostCount || 0) > 0) {
    return view.newPostCount
  }
  return null
}

/**
 * Dot-only unread (typed common views, not chat).
 */
export function viewShowsUnreadDot (view) {
  if (!view?.type || view.type === 'chat') return false
  return TYPED_BADGE_VIEW_TYPES.has(view.type) && (view.newPostCount || 0) > 0
}

/**
 * Whether a group's ContextMenu still has any unread signal: chat/typed view badges,
 * nested space view badges, or space membership dots.
 */
export function groupMenuHasUnreadBadges (group, getMembershipNewPostCount) {
  const items = group?.groupViews?.items || []
  for (const view of items) {
    if (view.type === 'space') {
      const spaceId = view.linkedGroup?.id
      if (spaceId && (getMembershipNewPostCount(spaceId) || 0) > 0) return true
      const nested = view.linkedGroup?.groupViews?.items || []
      if (nested.some(viewShowsUnreadBadge)) return true
      continue
    }
    if (viewShowsUnreadBadge(view)) return true
  }
  return false
}
