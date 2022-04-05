import { createSelector } from 'reselect'
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

export default getLastViewedGroup

// export const getLastViewedGroup = memberships => {
//   const lastViewedMembership = maxBy(m => new Date(m.lastViewedAt), memberships)
//   return get('group', lastViewedMembership)
// }
