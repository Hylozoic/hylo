import { createSelector as ormCreateSelector } from 'redux-orm'
import { myHomeLandingUrl, personUrl } from '@hylo/navigation'
import orm from 'store/models'
import { lastViewedGroupPathFromSession } from 'store/selectors/getLastViewedGroup'
import { isSpaceGroup } from 'store/selectors/getMyGroups'

/** Where someone in no groups lands: the Group Explorer. */
export const GROUP_EXPLORER_PATH = '/public/groups'

/** People in at least this many groups (spaces excluded) land on What's new. */
export const WHATS_NEW_MIN_GROUPS = 3

/** The current user's memberships (spaces included). */
function myMemberships ({ Me, Membership }) {
  const me = Me.first()
  if (!me) return { me: null, memberships: [] }
  return { me, memberships: Membership.filter({ person: me.id }).toModelArray() }
}

function countGroups (memberships) {
  return memberships.filter(membership => {
    const group = membership.group
    return !isSpaceGroup(group?.ref || group)
  }).length
}

/** How many groups the current user is in, not counting spaces. */
export const getTopLevelGroupCount = ormCreateSelector(
  orm,
  session => countGroups(myMemberships(session).memberships)
)

/**
 * Where Hylo opens when no page was asked for (the cold-open catch-all;
 * explicit URLs are never redirected):
 * - in no groups: the Group Explorer, every time, until they join one
 * - in 1-2 groups (spaces excluded): the group they last viewed
 * - in 3 or more: What's new, the All My Groups feed with a divider at
 *   their last visit
 */
export const getLandingPath = ormCreateSelector(
  orm,
  session => {
    const { me, memberships } = myMemberships(session)
    if (!me) return lastViewedGroupPathFromSession(session)
    if (memberships.length === 0) return GROUP_EXPLORER_PATH
    if (countGroups(memberships) >= WHATS_NEW_MIN_GROUPS) return myHomeLandingUrl()
    return lastViewedGroupPathFromSession(session)
  }
)

/**
 * Where /my opens: All My Groups, or My Profile for someone who isn't in any
 * group yet (All My Groups would be empty). The card-menu layout keeps its
 * own My Home menu at /my and doesn't use this.
 */
export const getMyHomePath = ormCreateSelector(
  orm,
  session => {
    const { me, memberships } = myMemberships(session)
    if (me && memberships.length === 0) return personUrl(me.id)
    return myHomeLandingUrl()
  }
)
