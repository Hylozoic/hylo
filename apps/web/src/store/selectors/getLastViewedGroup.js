import { createSelector as ormCreateSelector } from 'redux-orm'
import { createSelector } from 'reselect'
import { spaceHomeUrl } from '@hylo/navigation'
import orm from 'store/models'
import { isSpaceGroup } from 'store/selectors/getMyGroups'
import getMe from './getMe'

export const getLastViewedGroup = createSelector(
  getMe,
  currentUser => {
    if (currentUser?.memberships.count() > 0) {
      return currentUser
        .memberships
        .orderBy(m => new Date(m.lastViewedAt), 'desc')
        .first()
        .group
    }
  }
)

/**
 * Reopen path for the last viewed membership group, from an ORM session.
 * Spaces must reopen nested under their parent (`/groups/:parent/spaces/:local`),
 * not as a top-level `/groups/:spaceSlug`.
 */
export function lastViewedGroupPathFromSession ({ Me, Membership, Group }) {
  const me = Me.first()
  if (!me) return '/all'

  const memberships = Membership.filter({ person: me.id }).orderBy(m => new Date(m.lastViewedAt), 'desc')
  if (memberships.count() === 0) return '/all'

  const group = memberships.first().group
  if (!group) return '/all'

  const groupRef = group.ref || group
  if (!isSpaceGroup(groupRef) || !groupRef.parentId) {
    return `/groups/${groupRef.slug}`
  }

  const parentGroup = Group.withId(groupRef.parentId)
  if (!parentGroup?.slug) return `/groups/${groupRef.slug}`

  return spaceHomeUrl(parentGroup.slug, groupRef)
}

/** Cold-load reopen path for the last viewed membership group. */
export const getLastViewedGroupPath = ormCreateSelector(orm, lastViewedGroupPathFromSession)

export default getLastViewedGroup
