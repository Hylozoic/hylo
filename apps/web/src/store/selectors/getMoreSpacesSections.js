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

/**
 * Off-menu spaces for the Edit Menu page: drafts and archived only
 * (no related groups, no published active spaces).
 */
export function categorizeOffMenuSpacesForEdit (spaces, menuSpaceIds) {
  const draftTracks = []
  const archivedTracks = []
  const draftFundingRounds = []
  const archivedFundingRounds = []
  const otherArchivedSpaces = []

  for (const space of spaces || []) {
    if (menuSpaceIds.has(String(space.id))) continue

    const isArchived = space.active === false
    const isTrack = Boolean(space.track)
    const isFundingRound = Boolean(space.fundingRound)
    const isDraftTrack = isTrack && !space.track?.publishedAt
    const isDraftFunding = isFundingRound && !space.fundingRound?.publishedAt

    if (isArchived) {
      if (isTrack) archivedTracks.push(space)
      else if (isFundingRound) archivedFundingRounds.push(space)
      else otherArchivedSpaces.push(space)
      continue
    }

    if (isDraftTrack) draftTracks.push(space)
    else if (isDraftFunding) draftFundingRounds.push(space)
  }

  const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '')
  draftTracks.sort(sortByName)
  archivedTracks.sort(sortByName)
  draftFundingRounds.sort(sortByName)
  archivedFundingRounds.sort(sortByName)
  otherArchivedSpaces.sort(sortByName)

  return {
    draftTracks,
    archivedTracks,
    draftFundingRounds,
    archivedFundingRounds,
    otherArchivedSpaces
  }
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

/** Returns draft/archived off-menu sections for the Edit Menu page. */
export const getEditMenuOffMenuSections = ormCreateSelector(
  orm,
  (state, group) => group,
  (session, group) => {
    if (!group) {
      return {
        draftTracks: [],
        archivedTracks: [],
        draftFundingRounds: [],
        archivedFundingRounds: [],
        otherArchivedSpaces: [],
        hasAny: false
      }
    }

    const menuSpaceIds = getMenuSpaceIds(group.groupViews)
    const spaces = group.spaces?.items || []
    const sections = categorizeOffMenuSpacesForEdit(spaces, menuSpaceIds)
    const hasAny = sections.draftTracks.length +
      sections.archivedTracks.length +
      sections.draftFundingRounds.length +
      sections.archivedFundingRounds.length +
      sections.otherArchivedSpaces.length > 0

    return { ...sections, hasAny }
  }
)
