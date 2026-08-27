/** Parse GroupView.settings whether it arrived as an object or a JSON string. */
export function parseViewSettings (settings) {
  if (!settings) return {}
  if (typeof settings === 'object') return settings
  try {
    return JSON.parse(settings)
  } catch {
    return {}
  }
}

/** Ordered space ids stored on a space-collection view. */
export function spaceIdsFromSettings (settings) {
  const parsed = parseViewSettings(settings)
  return (parsed.spaceIds || []).map(id => String(id))
}

/** Settings object with spaceIds replaced, other keys preserved. */
export function withSpaceIds (settings, spaceIds) {
  return {
    ...parseViewSettings(settings),
    spaceIds: spaceIds.map(id => String(id))
  }
}

/** Append a space id if it is not already in the collection. */
export function appendSpaceId (settings, spaceId) {
  const ids = spaceIdsFromSettings(settings)
  const id = String(spaceId)
  if (ids.includes(id)) return withSpaceIds(settings, ids)
  return withSpaceIds(settings, [...ids, id])
}

/** Remove a space id from the collection. */
export function removeSpaceId (settings, spaceId) {
  const id = String(spaceId)
  return withSpaceIds(settings, spaceIdsFromSettings(settings).filter(existing => existing !== id))
}

/**
 * Reorder the visible slice of a space-collection without dropping ids the
 * current viewer cannot see (drafts, hidden spaces, etc.).
 */
export function reorderVisibleSpaceIds (fullIds, visibleIds, oldIndex, newIndex) {
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return fullIds.map(id => String(id))
  }
  const visible = visibleIds.map(id => String(id))
  const nextVisible = [...visible]
  const [moved] = nextVisible.splice(oldIndex, 1)
  nextVisible.splice(newIndex, 0, moved)
  const visibleSet = new Set(visible)
  let visibleIndex = 0
  return fullIds.map(id => visibleSet.has(String(id)) ? nextVisible[visibleIndex++] : String(id))
}

/**
 * Resolve ordered space objects from a group's spaces list.
 * Drops ids that no longer resolve (deleted spaces).
 */
export function resolveSpacesByIds (spaces, spaceIds) {
  const byId = new Map((spaces || []).map(space => [String(space.id), space]))
  return (spaceIds || [])
    .map(id => byId.get(String(id)))
    .filter(Boolean)
    .map(space => ({
      ...space,
      isDraft: space.status === 'draft'
    }))
}

/** Menu space-collection views for a group. */
export function spaceCollectionViews (groupViews) {
  const items = Array.isArray(groupViews) ? groupViews : (groupViews?.items || [])
  return items.filter(view => view.type === 'space-collection')
}

/** Collections that do not already include this space. */
export function collectionsWithoutSpace (collectionViews, spaceId) {
  if (spaceId == null) return collectionViews || []
  const id = String(spaceId)
  return (collectionViews || []).filter(view => !spaceIdsFromSettings(view.settings).includes(id))
}
