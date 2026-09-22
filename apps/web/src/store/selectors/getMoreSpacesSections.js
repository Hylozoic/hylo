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

function withDraftFlag (space) {
  return {
    ...space,
    isDraft: space.status === 'draft'
  }
}

/** Splits off-menu spaces into Drafts, Tracks, Funding Rounds, other Spaces, and Archived. */
export function categorizeOffMenuSpaces (spaces, menuSpaceIds) {
  const draftSpaces = []
  const trackSpaces = []
  const fundingRoundSpaces = []
  const otherSpaces = []
  const archivedSpaces = []

  for (const space of spaces || []) {
    if (menuSpaceIds.has(String(space.id))) continue
    if (space.active === false) continue

    if (space.status === 'archived') {
      archivedSpaces.push(withDraftFlag(space))
      continue
    }

    if (space.status === 'draft') {
      draftSpaces.push(withDraftFlag(space))
      continue
    }

    if (space.fundingRound) {
      fundingRoundSpaces.push(withDraftFlag(space))
    } else if (space.track) {
      trackSpaces.push(withDraftFlag(space))
    } else {
      otherSpaces.push(withDraftFlag(space))
    }
  }

  const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '')
  draftSpaces.sort(sortByName)
  trackSpaces.sort(sortByName)
  fundingRoundSpaces.sort(sortByName)
  otherSpaces.sort(sortByName)
  archivedSpaces.sort(sortByName)

  return { draftSpaces, trackSpaces, fundingRoundSpaces, otherSpaces, archivedSpaces }
}

/** Builds a fresh getMoreSpacesSections selector.
 * redux-orm memoizes exactly one result per selector, so components that render many
 * instances against different groups evict each other's cache and get a new object every
 * render. Those should hold their own instance — see useMoreSpacesSections. */
export function makeGetMoreSpacesSections () {
  return ormCreateSelector(
    orm,
    (state, group) => group,
    (session, group) => {
      if (!group) {
        return {
          draftSpaces: [],
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

      const hasAny = spaceSections.draftSpaces.length +
        spaceSections.trackSpaces.length +
        spaceSections.fundingRoundSpaces.length +
        spaceSections.otherSpaces.length +
        spaceSections.archivedSpaces.length > 0

      return {
        ...spaceSections,
        hasAny
      }
    }
  )
}

/** Returns sections for More Spaces (off-menu spaces only). */
export const getMoreSpacesSections = makeGetMoreSpacesSections()
