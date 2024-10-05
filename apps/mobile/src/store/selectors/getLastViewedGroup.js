import { createSelector } from 'reselect'
import { PUBLIC_GROUP } from 'store/models/Group'
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
    } else {
      return PUBLIC_GROUP
    }
  }
)

export default getLastViewedGroup

// export const getLastViewedGroup = memberships => {
//   const lastViewedMembership = maxBy(m => new Date(m.lastViewedAt), memberships)
//   return get('group', lastViewedMembership)
// }
