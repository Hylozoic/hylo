/**
 * `groupViews`/`spaces` are stored as raw `attr()` blobs on the Group model (see
 * store/models/Group.js), so the ModelExtractor never recurses into their nested
 * `linkedGroup`/space objects to promote them into their own normalized Group
 * records. That means richer fields fetched only in these nested payloads (e.g. a
 * Space's `track`) never reach the Group entity looked up by slug/id elsewhere
 * (e.g. store/selectors/getGroupForSlug) unless we extract them explicitly.
 *
 * Collects every `linkedGroup` object nested within a `groupViews.items` array,
 * recursing into each linkedGroup's own `groupViews.items` (spaces can have their
 * own space-type views).
 */
export function collectLinkedGroups (items) {
  const result = []
  for (const view of items || []) {
    if (view?.linkedGroup?.id) {
      result.push(view.linkedGroup)
      result.push(...collectLinkedGroups(view.linkedGroup.groupViews?.items))
    }
  }
  return result
}

/** Collects each space Group object from a `spaces.items` array, including their nested space views. */
export function collectSpaceGroups (items) {
  const result = []
  for (const space of items || []) {
    if (space?.id) {
      result.push(space)
      result.push(...collectLinkedGroups(space.groupViews?.items))
    }
  }
  return result
}
