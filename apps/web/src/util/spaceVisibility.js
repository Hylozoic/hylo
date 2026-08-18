import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import { parseAccessGrants } from 'util/accessGrants'

/**
 * Space ids that have at least one published offering granting group access.
 */
export function spaceIdsGrantedByPublishedOfferings (offerings) {
  const ids = new Set()
  for (const offering of offerings || []) {
    if (offering.publishStatus !== 'published') continue
    const grants = parseAccessGrants(offering.accessGrants)
    for (const groupId of grants.groupIds || []) {
      ids.add(String(groupId))
    }
  }
  return ids
}

/**
 * Viewer context for menu / More Spaces space-visibility checks.
 */
export function spaceMenuVisibilityOpts ({
  offerings,
  canManageSpaces,
  memberships,
  currentUser,
  parentGroupId
}) {
  return {
    offerings,
    canManageSpaces,
    memberSpaceIds: new Set((memberships || []).map(m => String(m.group?.id))),
    viewerRoleIds: new Set(
      (currentUser?.groupRoles?.items || [])
        .filter(role => String(role.groupId) === String(parentGroupId))
        .map(role => String(role.id))
    )
  }
}

/**
 * Whether a space should appear in the menu / More Spaces for this viewer.
 * Managers see every space. Others see paywalled spaces only with a granting
 * offering, role-gated spaces only with a required role, and Hidden/Closed
 * (invite-only) spaces only if they are already a member.
 */
export function shouldShowSpaceInMenu (space, {
  grantedSpaceIds,
  canManageSpaces,
  memberSpaceIds,
  viewerRoleIds
} = {}) {
  if (!space) return false
  if (canManageSpaces) return true

  if (space.paywall) {
    return Boolean(grantedSpaceIds?.has(String(space.id)))
  }

  const requiredRoles = space.requiredRoles || []
  if (requiredRoles.length > 0) {
    return requiredRoles.some(id => viewerRoleIds?.has(String(id)))
  }

  const isHiddenOrClosed =
    space.visibility === GROUP_VISIBILITY.Hidden ||
    space.accessibility === GROUP_ACCESSIBILITY.Closed
  if (isHiddenOrClosed) {
    return Boolean(memberSpaceIds?.has(String(space.id)))
  }

  return true
}

/**
 * Whether a paywalled space should appear in the menu / More Spaces for this viewer.
 * Non-paywalled spaces are always visible. Managers always see paywalled spaces
 * even when no granting offering exists yet.
 */
export function shouldShowPaywalledSpaceInMenu (space, opts) {
  return shouldShowSpaceInMenu(space, opts)
}

/**
 * Filters space groups for menu / More Spaces visibility.
 */
export function filterSpacesForMenuVisibility (spaces, opts) {
  const grantedSpaceIds = spaceIdsGrantedByPublishedOfferings(opts?.offerings)
  return (spaces || []).filter(space =>
    shouldShowSpaceInMenu(space, { ...opts, grantedSpaceIds })
  )
}

/**
 * Filters groupViews, hiding space rows the viewer should not see.
 */
export function filterSpaceViewsForMenuVisibility (views, opts) {
  const grantedSpaceIds = spaceIdsGrantedByPublishedOfferings(opts?.offerings)
  return (views || []).filter(view => {
    if (view.type !== 'space') return true
    return shouldShowSpaceInMenu(view.linkedGroup, { ...opts, grantedSpaceIds })
  })
}

/**
 * Filters More Views and Spaces section lists for spaces the viewer should not see.
 */
export function filterMoreSpacesSections (sections, opts) {
  if (!sections) return sections
  const trackSpaces = filterSpacesForMenuVisibility(sections.trackSpaces, opts)
  const fundingRoundSpaces = filterSpacesForMenuVisibility(sections.fundingRoundSpaces, opts)
  const otherSpaces = filterSpacesForMenuVisibility(sections.otherSpaces, opts)
  const archivedSpaces = filterSpacesForMenuVisibility(sections.archivedSpaces, opts)
  const hasAny = trackSpaces.length +
    fundingRoundSpaces.length +
    otherSpaces.length +
    archivedSpaces.length > 0
  return {
    trackSpaces,
    fundingRoundSpaces,
    otherSpaces,
    archivedSpaces,
    hasAny
  }
}
