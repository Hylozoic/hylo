import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

/** Returns ids of space groups linked from ordered (in-menu) space views only. */
export function getMenuSpaceIds (groupViews) {
  const items = Array.isArray(groupViews) ? groupViews : (groupViews?.items || [])
  return new Set(
    items
      .filter(view => view.type === 'space' && view.order != null && view.linkedGroup?.id)
      .map(view => String(view.linkedGroup.id))
  )
}

/** Splits off-menu spaces into Tracks, Funding Rounds, other Spaces, and Archived. */
export function categorizeOffMenuSpaces (spaces, menuSpaceIds) {
  const trackSpaces = []
  const fundingRoundSpaces = []
  const otherSpaces = []
  const archivedSpaces = []

  for (const space of spaces || []) {
    if (menuSpaceIds.has(String(space.id))) continue

    if (space.active === false) {
      archivedSpaces.push(space)
      continue
    }

    if (space.fundingRound) {
      fundingRoundSpaces.push(space)
    } else if (space.track) {
      trackSpaces.push({
        ...space,
        isDraft: !space.track.publishedAt
      })
    } else {
      otherSpaces.push(space)
    }
  }

  const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '')
  trackSpaces.sort(sortByName)
  fundingRoundSpaces.sort(sortByName)
  otherSpaces.sort(sortByName)
  archivedSpaces.sort(sortByName)

  return { trackSpaces, fundingRoundSpaces, otherSpaces, archivedSpaces }
}

/** Returns sections for More Spaces (off-menu spaces only). */
export const getMoreViewsSections = ormCreateSelector(
  orm,
  (state, group) => group,
  (session, group) => {
    if (!group) {
      return {
        trackSpaces: [],
        fundingRoundSpaces: [],
        otherSpaces: [],
        archivedSpaces: [],
        hasAny: false
      }
    }

    const menuSpaceIds = getMenuSpaceIds(group.groupViews)
    const spaces = group.spaces?.items || []
    const spaceSections = categorizeOffMenuSpaces(spaces, menuSpaceIds)
    const otherSpaces = [...spaceSections.otherSpaces, ...spaceSections.archivedSpaces]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const hasAny = spaceSections.trackSpaces.length +
      spaceSections.fundingRoundSpaces.length +
      otherSpaces.length > 0

    return {
      trackSpaces: spaceSections.trackSpaces,
      fundingRoundSpaces: spaceSections.fundingRoundSpaces,
      otherSpaces,
      archivedSpaces: [],
      hasAny
    }
  }
)

/** @deprecated Use getMoreViewsSections. */
export const getMoreSpacesSections = getMoreViewsSections

/** @deprecated Edit menu now uses the same More Spaces sections. */
export const getEditMenuOffMenuSections = getMoreViewsSections
