import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

/** Returns ids of space groups linked from the group's menu. */
export function getMenuSpaceIds (groupViews) {
  const items = Array.isArray(groupViews) ? groupViews : (groupViews?.items || [])
  return new Set(
    items
      .filter(view => view.type === 'space' && view.linkedGroup?.id)
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

/** Returns off-menu space sections for the More Spaces menu expand. */
export const getMoreSpacesSections = ormCreateSelector(
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
    const sections = categorizeOffMenuSpaces(spaces, menuSpaceIds)
    const hasAny = sections.trackSpaces.length +
      sections.fundingRoundSpaces.length +
      sections.otherSpaces.length +
      sections.archivedSpaces.length > 0

    return { ...sections, hasAny }
  }
)
