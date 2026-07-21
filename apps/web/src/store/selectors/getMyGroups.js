import { createSelector } from 'redux-orm'
import orm from 'store/models'
import { GROUP_TYPES } from 'store/models/Group'
import getMyMemberships from 'store/selectors/getMyMemberships'

export const getMyGroups = createSelector(
  orm,
  getMyMemberships,
  (_, memberships) => {
    return memberships
      .filter(m => m.group.ref.type !== GROUP_TYPES.space)
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

export const getMyGroupsWithChildren = createSelector(
  orm,
  getMyMemberships,
  (_, memberships) => {
    return memberships
      .filter(m => m.group.ref.type !== GROUP_TYPES.space)
      .map(m => {
        const childGroups = m.group.childGroups
          ?.toModelArray()
          .filter(c => c.type !== GROUP_TYPES.space)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl, slug: c.slug })) || []
        return {
          ...m.group.ref,
          newPostCount: m.newPostCount,
          navOrder: m.navOrder,
          childGroups
        }
      })
      .sort((a, b) => {
        const aOrder = a.navOrder ?? Infinity
        const bOrder = b.navOrder ?? Infinity
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        return a.name.localeCompare(b.name)
      })
  }
)

export default getMyGroups
