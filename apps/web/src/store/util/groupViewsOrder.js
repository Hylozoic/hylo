import { homeRoutePathForView } from '@hylo/navigation'

/** Merge menu patch fields onto a view row (deep-merge linkedGroup when present). */
function mergeViewMenuPatch (view, updates) {
  if (!updates) return view
  const merged = { ...view, ...updates }
  if (updates.linkedGroup) {
    merged.linkedGroup = { ...(view.linkedGroup || {}), ...updates.linkedGroup }
  }
  return merged
}

/** Merge display fields from Redux into a local list, preserving local order. */
function mergeViewFromSource (localView, sourceView) {
  const merged = { ...localView, ...sourceView }
  if (sourceView.linkedGroup || localView.linkedGroup) {
    const localGroup = localView.linkedGroup || {}
    const sourceGroup = sourceView.linkedGroup || {}
    const localItems = localGroup.groupViews?.items
    const sourceItems = sourceGroup.groupViews?.items

    merged.linkedGroup = { ...localGroup, ...sourceGroup }
    if (localItems && sourceItems) {
      merged.linkedGroup.groupViews = {
        items: mergeOrderedViewsFromSource(localItems, sourceItems)
      }
    } else if (sourceItems) {
      merged.linkedGroup.groupViews = { items: sourceItems }
    }
  }
  return merged
}

/** Merge Redux view rows into a local ordered list (full replace when IDs change). */
export function mergeOrderedViewsFromSource (localViews, sourceViews) {
  const source = sourceViews || []
  const sourceIds = source.map(v => String(v.id)).join(',')
  const localIds = (localViews || []).map(v => String(v.id)).join(',')

  if (sourceIds !== localIds) {
    return [...source].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const byId = new Map(source.map(v => [String(v.id), v]))
  return (localViews || []).map(localView => {
    const sourceView = byId.get(String(localView.id))
    return sourceView ? mergeViewFromSource(localView, sourceView) : localView
  })
}

/** Patch fields on a view in a group's embedded menu (or nested space menu). */
export function updateGroupViewInMenu (group, viewId, updates) {
  if (!group || !viewId || !updates) return

  const patchItems = (items) => (items || []).map(view =>
    String(view.id) === String(viewId) ? mergeViewMenuPatch(view, updates) : view
  )

  const items = group.groupViews?.items || []
  let changed = false
  const newItems = items.map(view => {
    if (String(view.id) === String(viewId)) {
      changed = true
      return mergeViewMenuPatch(view, updates)
    }
    if (view.type === 'space' && view.linkedGroup?.groupViews?.items) {
      const spaceItems = patchItems(view.linkedGroup.groupViews.items)
      if (spaceItems.some((item, index) => item !== view.linkedGroup.groupViews.items[index])) {
        changed = true
        return {
          ...view,
          linkedGroup: {
            ...view.linkedGroup,
            groupViews: { items: structuredClone(spaceItems) }
          }
        }
      }
    }
    return view
  })

  if (changed) {
    group.update({ groupViews: { items: structuredClone(newItems) } })
  }
}

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
