import { homeRoutePathForView } from '@hylo/navigation'

/** Append a newly created view to the end of a group's embedded menu list. */
export function appendGroupViewToMenu (group, newView) {
  if (!group || !newView?.id) return
  const items = group.groupViews?.items || []
  if (items.some(view => String(view.id) === String(newView.id))) return
  const maxOrder = items.reduce((max, view) => Math.max(max, view.order ?? 0), -1)
  const viewWithOrder = { ...newView, order: newView.order ?? maxOrder + 1 }
  group.update({ groupViews: { items: structuredClone([...items, viewWithOrder]) } })
}

/** Remove a view from a group's embedded menu list. */
export function removeGroupViewFromMenu (group, viewId) {
  if (!group || !viewId) return
  const items = (group.groupViews?.items || []).filter(view => String(view.id) !== String(viewId))
  group.update({ groupViews: { items: structuredClone(items) } })
}

/** Write a reordered view list into a Group's embedded groupViews (or nested space views). */
export function applyGroupViewsOrder ({ group, parentGroupId, targetGroupId, reorderedItems, updateHomeRoute = false }) {
  if (!group) return

  const itemsWithOrder = reorderedItems.map((view, index) => ({ ...view, order: index }))

  if (String(parentGroupId) === String(targetGroupId)) {
    const updates = { groupViews: { items: structuredClone(itemsWithOrder) } }
    if (updateHomeRoute && itemsWithOrder[0]) {
      updates.homeRoute = homeRoutePathForView(itemsWithOrder[0])
    }
    group.update(updates)
    return
  }

  const items = group.groupViews?.items || []
  const newItems = items.map(view => {
    if (view.type === 'space' && String(view.linkedGroup?.id) === String(targetGroupId)) {
      return {
        ...view,
        linkedGroup: {
          ...view.linkedGroup,
          groupViews: { items: structuredClone(itemsWithOrder) }
        }
      }
    }
    return view
  })
  group.update({ groupViews: { items: structuredClone(newItems) } })
}
