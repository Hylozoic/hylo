import { createSelector } from 'reselect'
import getMe from './getMe'
import getMyMemberships from './getMyMemberships'

/**
 * True when anything the nav badges is unread: new posts in any membership,
 * unseen message threads, or new notifications.
 */
const getHasUnreadActivity = createSelector(
  getMe,
  getMyMemberships,
  (me, memberships) =>
    (me?.unseenThreadCount || 0) > 0 ||
    (me?.newNotificationCount || 0) > 0 ||
    memberships.some(membership => (membership.newPostCount || 0) > 0)
)

export default getHasUnreadActivity
