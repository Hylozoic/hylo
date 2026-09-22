/**
 * `groupViews`/`spaces` are stored as raw `attr()` blobs on the Group model (see
 * store/models/Group.js), so the ModelExtractor never recurses into their nested
 * `linkedGroup`/space objects to promote them into their own normalized Group
 * records. That means richer fields fetched only in these nested payloads (e.g. a
 * Space's `track`) never reach the Group entity looked up by slug/id elsewhere
 * (e.g. store/selectors/getGroupForSlug) unless we extract them explicitly.
 *
 * Nested `groupViews` stay on the parent menu blob only. Extracting them onto
 * the space Group overwrites unread counts from a dedicated fetchGroupViews.
 *
 * Collects every `linkedGroup` object nested within a `groupViews.items` array,
 * recursing into each linkedGroup's own `groupViews.items` (spaces can have their
 * own space-type views). Every GraphQL `linkedGroup` selection must include
 * `slug` — space URLs are built from it, and a later extract without slug
 * overwrites the menu copy used by those links.
 */
function groupExtractPayload (group) {
  if (!group) return group
  const rest = { ...group }
  delete rest.groupViews
  delete rest.spaces
  return rest
}

export function collectLinkedGroups (items) {
  const result = []
  for (const view of items || []) {
    if (view?.linkedGroup?.id) {
      result.push(groupExtractPayload(view.linkedGroup))
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
      result.push(groupExtractPayload(space))
      result.push(...collectLinkedGroups(space.groupViews?.items))
    }
  }
  return result
}

/** Collects linked groups from every group in a batch `groups.items` response. */
export function collectLinkedGroupsFromGroupsQuery (groupsData) {
  const result = []
  for (const group of groupsData?.items || []) {
    result.push(...collectLinkedGroups(group.groupViews?.items))
  }
  return result
}

/** Collects space groups from every group in a batch `groups.items` response. */
export function collectSpaceGroupsFromGroupsQuery (groupsData) {
  const result = []
  for (const group of groupsData?.items || []) {
    result.push(...collectSpaceGroups(group.spaces?.items))
  }
  return result
}
