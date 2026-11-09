import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

/** Finds a GroupView by id on a group menu or nested space menus. */
function findGroupViewById (group, viewId) {
  if (!group || !viewId) return null
  const match = (items) => (items || []).find(v => String(v.id) === String(viewId))
  const topLevel = match(group.groupViews?.items)
  if (topLevel) return topLevel
  for (const view of group.groupViews?.items || []) {
    if (view.type === 'space') {
      const nested = match(view.linkedGroup?.groupViews?.items)
      if (nested) return nested
    }
  }
  return null
}

/** Sort views with ordered items first, then hidden (order = null) at the end. */
function sortViewsByMenuOrder (views) {
  return [...(views || [])].sort((a, b) => {
    if (a.order == null && b.order == null) return 0
    if (a.order == null) return 1
    if (b.order == null) return -1
    return a.order - b.order
  })
}

/** Builds a fresh getGroupViews selector.
 * redux-orm memoizes exactly one result per selector, so components that render many
 * instances against different groups evict each other's cache and get a new array every
 * render. Those should hold their own instance — see useGroupViews. */
export function makeGetGroupViews () {
  return ormCreateSelector(
    orm,
    (state, group) => group?.id,
    (session, groupId) => {
      if (!groupId) return []
      const group = session.Group.withId(groupId)
      if (!group) return []
      return sortViewsByMenuOrder(group.groupViews?.items || [])
    }
  )
}

/** Returns the ordered GroupView items for a given group object, or [] if not yet loaded.
 * Includes hidden views (order = null) at the end — filter for the live menu separately. */
export const getGroupViews = makeGetGroupViews()

/** Returns a single GroupView from a group's menu (including nested space views). */
export const getGroupViewById = ormCreateSelector(
  orm,
  (state, group, viewId) => ({ group, viewId }),
  (session, { group, viewId }) => findGroupViewById(group, viewId)
)
