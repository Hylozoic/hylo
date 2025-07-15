import { createSelector } from 'redux-orm'
import orm from 'store/models'
import getMyMemberships from 'store/selectors/getMyMemberships'

export const getMyGroups = createSelector(
  orm,
  getMyMemberships,
  (_, memberships) => {
    return memberships
      .map(m => ({
        ...m.group.ref,
        newPostCount: m.newPostCount,
        navOrder: m.navOrder
      }))
      .sort((a, b) => {
        // First sort by navOrder (pinned groups first)
        const aOrder = a.navOrder ?? Infinity
        const bOrder = b.navOrder ?? Infinity
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        // Then sort alphabetically for groups with same navOrder
        return a.name.localeCompare(b.name)
      })
  }
)

export default getMyGroups
