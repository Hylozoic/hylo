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

/** Returns the ordered GroupView items for a given group object, or [] if not yet loaded. */
export const getGroupViews = ormCreateSelector(
  orm,
  (state, group) => group,
  (session, group) => {
    const items = group?.groupViews?.items || []
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
)

/** Returns a single GroupView from a group's menu (including nested space views). */
export const getGroupViewById = ormCreateSelector(
  orm,
  (state, group, viewId) => ({ group, viewId }),
  (session, { group, viewId }) => findGroupViewById(group, viewId)
)
