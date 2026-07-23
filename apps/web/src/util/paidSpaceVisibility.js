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
 * Whether a paywalled space should appear in the menu / More Spaces for this viewer.
 * Non-paywalled spaces are always visible. Managers always see paywalled spaces
 * even when no granting offering exists yet.
 */
export function shouldShowPaywalledSpaceInMenu (space, { grantedSpaceIds, canManageSpaces }) {
  if (!space?.paywall) return true
  if (canManageSpaces) return true
  return Boolean(grantedSpaceIds?.has(String(space.id)))
}

/**
 * Filters space groups for menu / More Spaces visibility.
 */
export function filterSpacesForMenuVisibility (spaces, { offerings, canManageSpaces }) {
  const grantedSpaceIds = spaceIdsGrantedByPublishedOfferings(offerings)
  return (spaces || []).filter(space =>
    shouldShowPaywalledSpaceInMenu(space, { grantedSpaceIds, canManageSpaces })
  )
}

/**
 * Filters groupViews, hiding paywalled space rows without a granting published offering
 * (unless the viewer can manage spaces).
 */
export function filterSpaceViewsForMenuVisibility (views, { offerings, canManageSpaces }) {
  const grantedSpaceIds = spaceIdsGrantedByPublishedOfferings(offerings)
  return (views || []).filter(view => {
    if (view.type !== 'space') return true
    return shouldShowPaywalledSpaceInMenu(view.linkedGroup, { grantedSpaceIds, canManageSpaces })
  })
}

/**
 * Filters More Views and Spaces section lists for paywalled spaces without published offerings.
 */
export function filterMoreSpacesSections (sections, { offerings, canManageSpaces }) {
  if (!sections) return sections
  const opts = { offerings, canManageSpaces }
  const trackSpaces = filterSpacesForMenuVisibility(sections.trackSpaces, opts)
  const fundingRoundSpaces = filterSpacesForMenuVisibility(sections.fundingRoundSpaces, opts)
  const otherSpaces = filterSpacesForMenuVisibility(sections.otherSpaces, opts)
  const archivedSpaces = filterSpacesForMenuVisibility(sections.archivedSpaces, opts)
  const offMenuViews = sections.offMenuViews || []
  const hasAny = offMenuViews.length +
    trackSpaces.length +
    fundingRoundSpaces.length +
    otherSpaces.length +
    archivedSpaces.length > 0
  return {
    offMenuViews,
    trackSpaces,
    fundingRoundSpaces,
    otherSpaces,
    archivedSpaces,
    hasAny
  }
}
