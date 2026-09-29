import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

// The user setting profileNudge: someone who skipped the welcome wizard's photo and
// location steps because they signed up from an invitation is asked for them once,
// after their first post (D16).
export const PROFILE_NUDGE_PENDING = 'pending'
export const PROFILE_NUDGE_DISMISSED = 'dismissed'
export const PROFILE_NUDGE_DONE = 'done'

// New accounts get a generated placeholder avatar from this service
const PLACEHOLDER_AVATAR_PREFIX = 'https://www.gravatar.com/avatar/'

/** Whether this avatar URL is missing or only the placeholder every new account gets. */
export function isPlaceholderAvatar (avatarUrl) {
  return !avatarUrl || String(avatarUrl).startsWith(PLACEHOLDER_AVATAR_PREFIX)
}

/** Whether this person still has no photo of their own, or no location. */
export function isMissingPhotoOrLocation (person) {
  if (!person) return false
  return isPlaceholderAvatar(person.avatarUrl) || !person.location
}

// Chat activity notices are made by Hylo, not written by the person
const NOTICE_POST_TYPES = ['chat_activity']

/**
 * Whether this person has a post of their own that the server has saved: a post or chat
 * they wrote here, or one loaded from the server. A post still being sent has a local id.
 */
export const getHasOwnPost = ormCreateSelector(
  orm,
  (state, userId) => userId,
  (session, userId) => !!userId && session.Post.all()
    .filter(post => String(post.creator) === String(userId) &&
      !NOTICE_POST_TYPES.includes(post.type) &&
      !String(post.id).startsWith('post_'))
    .exists()
)
