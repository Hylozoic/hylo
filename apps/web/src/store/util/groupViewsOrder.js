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

/** Sort views with ordered items first (by order), then hidden (order = null) at the end. */
export function sortViewsByMenuOrder (views) {
  return [...(views || [])].sort((a, b) => {
    if (a.order == null && b.order == null) return 0
    if (a.order == null) return 1
    if (b.order == null) return -1
    return a.order - b.order
  })
}

/** Merge Redux view rows into a local ordered list (full replace when IDs change). */
export function mergeOrderedViewsFromSource (localViews, sourceViews) {
  const source = sourceViews || []
  const sourceIds = source.map(v => String(v.id)).join(',')
  const localIds = (localViews || []).map(v => String(v.id)).join(',')

  if (sourceIds !== localIds) {
    return sortViewsByMenuOrder(source)
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

/**
 * Patch a view id across every loaded group's menu — including when the view lives
 * inside a parent's type=space linkedGroup.groupViews (ContextMenu reads that copy).
 */
export function updateGroupViewInAllMenus (groups, viewId, updates) {
  if (!viewId || !updates) return
  const list = typeof groups?.toModelArray === 'function'
    ? groups.toModelArray()
    : (groups || [])
  list.forEach(group => updateGroupViewInMenu(group, viewId, updates))
}

/** Append a newly created view to the end of a group's embedded menu list. */
export function appendGroupViewToMenu (group, newView) {
  if (!group || !newView?.id) return
  const items = group.groupViews?.items || []
  if (items.some(view => String(view.id) === String(newView.id))) return
  const maxOrder = items.reduce((max, view) => {
    if (view.order == null) return max
    return Math.max(max, view.order)
  }, -1)
  const viewWithOrder = { ...newView, order: newView.order ?? maxOrder + 1 }
  group.update({ groupViews: { items: structuredClone([...items, viewWithOrder]) } })
}

/**
 * Optimistically hide (order = null) or show (append) a view in the embedded menu.
 * When hiding, compact remaining ordered views to contiguous 0..n.
 */
export function setGroupViewHiddenInMenu (group, viewId, hidden) {
  if (!group || !viewId) return

  const applyToItems = (items) => {
    const list = items || []
    const target = list.find(view => String(view.id) === String(viewId))
    if (!target) return null

    if (hidden) {
      if (target.order === 0 || target.order == null) return null
      const remaining = list
        .filter(view => String(view.id) !== String(viewId) && view.order != null)
        .sort((a, b) => a.order - b.order)
        .map((view, index) => ({ ...view, order: index }))
      const hiddenView = { ...target, order: null }
      const otherHidden = list.filter(view =>
        String(view.id) !== String(viewId) && view.order == null
      )
      return [...remaining, ...otherHidden, hiddenView]
    }

    if (target.order != null) return null
    const maxOrder = list.reduce((max, view) => {
      if (view.order == null) return max
      return Math.max(max, view.order)
    }, -1)
    return list.map(view =>
      String(view.id) === String(viewId) ? { ...view, order: maxOrder + 1 } : view
    )
  }

  const items = group.groupViews?.items || []
  const topLevel = applyToItems(items)
  if (topLevel) {
    group.update({ groupViews: { items: structuredClone(topLevel) } })
    return
  }

  // Nested space menus
  let changed = false
  const newItems = items.map(view => {
    if (view.type !== 'space' || !view.linkedGroup?.groupViews?.items) return view
    const nested = applyToItems(view.linkedGroup.groupViews.items)
    if (!nested) return view
    changed = true
    return {
      ...view,
      linkedGroup: {
        ...view.linkedGroup,
        groupViews: { items: structuredClone(nested) }
      }
    }
  })
  if (changed) {
    group.update({ groupViews: { items: structuredClone(newItems) } })
  }
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

/**
 * Syncs funding-round fields onto embedded Group.fundingRound blobs used by menus
 * (parent groupViews.linkedGroup.fundingRound, space Group.fundingRound, spaces list).
 */
export function syncFundingRoundEmbeddedData (session, fundingRoundId, patch) {
  if (!session?.Group || !fundingRoundId || !patch) return

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  )
  if (Object.keys(cleanPatch).length === 0) return

  session.Group.all().toModelArray().forEach(group => {
    const updates = {}

    if (group.fundingRound && String(group.fundingRound.id) === String(fundingRoundId)) {
      updates.fundingRound = { ...group.fundingRound, ...cleanPatch }
    }

    const menuItems = group.groupViews?.items
    if (menuItems?.length) {
      let menuChanged = false
      const newMenuItems = menuItems.map(view => {
        if (view.type !== 'space' || !view.linkedGroup?.fundingRound) return view
        if (String(view.linkedGroup.fundingRound.id) !== String(fundingRoundId)) return view
        menuChanged = true
        return {
          ...view,
          linkedGroup: {
            ...view.linkedGroup,
            fundingRound: { ...view.linkedGroup.fundingRound, ...cleanPatch }
          }
        }
      })
      if (menuChanged) {
        updates.groupViews = { items: structuredClone(newMenuItems) }
      }
    }

    const spaces = group.spaces?.items || group.spaces
    if (Array.isArray(spaces) && spaces.length) {
      let spacesChanged = false
      const newSpaces = spaces.map(space => {
        if (!space?.fundingRound || String(space.fundingRound.id) !== String(fundingRoundId)) return space
        spacesChanged = true
        return {
          ...space,
          fundingRound: { ...space.fundingRound, ...cleanPatch }
        }
      })
      if (spacesChanged) {
        updates.spaces = group.spaces?.items
          ? { ...group.spaces, items: structuredClone(newSpaces) }
          : structuredClone(newSpaces)
      }
    }

    if (Object.keys(updates).length > 0) {
      group.update(updates)
    }
  })
}
