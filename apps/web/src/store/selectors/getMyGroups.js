import { createSelector } from 'redux-orm'
import orm from 'store/models'
import { GROUP_TYPES } from 'store/models/Group'
import getMyMemberships from 'store/selectors/getMyMemberships'

/** True when a group record represents a Space (`type = space`) */
export function isSpaceGroup (group) {
  return group?.type === GROUP_TYPES.space
}

/** Sorts groups by nav pin order, then alphabetically by name. */
function sortGroups (a, b) {
  const aOrder = a.navOrder ?? Infinity
  const bOrder = b.navOrder ?? Infinity
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.name.localeCompare(b.name)
}

/** Builds a plain summary object for a nested group or space row. */
function toNestedGroupSummary (group, extras = {}) {
  return {
    id: group.id,
    name: group.name,
    avatarUrl: group.avatarUrl,
    slug: group.slug,
    type: group.type,
    parentId: group.parentId,
    ...extras
  }
}

/**
 * Builds a memoized tree of the user's groups for My Groups and group nav.
 * Top-level rows exclude spaces; each parent includes a `spaces` array of the
 * user's space memberships nested underneath.
 */
function buildMyGroupsTree (session, memberships) {
  const spaceMemberships = []
  const topLevelMemberships = []

  for (const membership of memberships) {
    if (isSpaceGroup(membership.group.ref)) {
      spaceMemberships.push(membership)
    } else {
      topLevelMemberships.push(membership)
    }
  }

  const spacesByParentId = new Map()
  for (const membership of spaceMemberships) {
    const space = membership.group.ref
    const parentId = space.parentId != null ? String(space.parentId) : null
    if (!parentId) continue
    if (!spacesByParentId.has(parentId)) spacesByParentId.set(parentId, [])
    spacesByParentId.get(parentId).push(toNestedGroupSummary(space, {
      membershipId: membership.id,
      newPostCount: membership.newPostCount,
      navOrder: membership.navOrder
    }))
  }

  for (const spaces of spacesByParentId.values()) {
    spaces.sort((a, b) => a.name.localeCompare(b.name))
  }

  const groups = topLevelMemberships.map(membership => {
    const group = membership.group.ref
    const childGroups = membership.group.childGroups
      ?.toModelArray()
      .filter(child => !isSpaceGroup(child.ref))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(child => toNestedGroupSummary(child.ref)) || []

    const spaces = spacesByParentId.get(String(group.id)) || []
    spacesByParentId.delete(String(group.id))

    return {
      ...group,
      membershipId: membership.id,
      newPostCount: membership.newPostCount,
      navOrder: membership.navOrder,
      childGroups,
      spaces
    }
  })

  // Spaces whose parent group is not in the user's memberships still nest under that parent.
  for (const [parentId, spaces] of spacesByParentId) {
    const parentGroup = session.Group.withId(parentId)
    if (!parentGroup) continue
    groups.push({
      ...parentGroup.ref,
      membershipId: null,
      newPostCount: 0,
      navOrder: null,
      childGroups: [],
      spaces,
      isParentOnly: true
    })
  }

  return groups.sort(sortGroups)
}

export const getMyGroups = createSelector(
  orm,
  getMyMemberships,
  (session, memberships) => {
    return buildMyGroupsTree(session, memberships)
      .filter(group => !group.isParentOnly)
      .map(({ childGroups, spaces, membershipId, isParentOnly, ...group }) => ({
        ...group,
        newPostCount: group.newPostCount,
        navOrder: group.navOrder
      }))
  }
)

export const getMyGroupsWithChildren = createSelector(
  orm,
  getMyMemberships,
  buildMyGroupsTree
)

export default getMyGroups
