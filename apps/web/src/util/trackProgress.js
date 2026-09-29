import { localSpaceSlug, spaceUrl } from '@hylo/navigation'

// D33: how far someone is through a track, and what to do next.

/** Completed and total counts for a list of action posts (each with completedAt). */
export function trackProgress (actions) {
  const list = (actions || []).filter(Boolean)
  const completed = list.filter(action => action.completedAt).length
  return progressFromCounts(completed, list.length)
}

/** Progress from counts, never more completed than there are actions. */
export function progressFromCounts (completed, total) {
  const safeTotal = Math.max(0, Number(total) || 0)
  const safeCompleted = Math.min(Math.max(0, Number(completed) || 0), safeTotal)
  return {
    completed: safeCompleted,
    total: safeTotal,
    percent: safeTotal ? Math.round(safeCompleted / safeTotal * 100) : 0,
    isComplete: safeTotal > 0 && safeCompleted === safeTotal
  }
}

/**
 * The next action to do after the current one: the first incomplete action after it
 * in the track's order, else the first incomplete one before it. Null when everything
 * else is done.
 */
export function nextIncompleteAction (actions, currentId) {
  const list = (actions || []).filter(Boolean)
  const index = list.findIndex(action => String(action.id) === String(currentId))
  const isOpen = action => !action.completedAt && String(action.id) !== String(currentId)
  return list.slice(index + 1).find(isOpen) || list.slice(0, Math.max(index, 0)).find(isOpen) || null
}

/** A track learner's own progress from their membership settings (actionsCompleted). */
export function progressFromSettings (settings, numActions, didComplete) {
  const total = Number(numActions) || 0
  if (didComplete || settings?.completedAt) return progressFromCounts(total, total)
  return progressFromCounts(settings?.actionsCompleted || 0, total)
}

export const MAX_TRACK_SUGGESTIONS = 3
const UNLISTED_STATUSES = ['draft', 'archived']

/**
 * Other tracks worth suggesting from the parent group's spaces: published, active,
 * with actions, not this one and not already completed. Ones the learner is already
 * enrolled in come first.
 */
export function suggestedTracks (spaces, currentSpaceId) {
  return (spaces || [])
    .filter(space => space?.track?.id && String(space.id) !== String(currentSpaceId))
    .filter(space => space.active !== false && !UNLISTED_STATUSES.includes(space.status))
    .filter(space => !space.track.didComplete && (space.track.numActions == null || space.track.numActions > 0))
    .sort((a, b) => Number(!!b.track.isEnrolled) - Number(!!a.track.isEnrolled) || (a.name || '').localeCompare(b.name || ''))
    .slice(0, MAX_TRACK_SUGGESTIONS)
}

/** Link to a track space's About page, which others can use to enroll. */
export function trackShareUrl (parentSlug, space) {
  if (!parentSlug || !space?.slug) return null
  return spaceUrl(parentSlug, localSpaceSlug(parentSlug, space.slug), '/about')
}

/** Progress per track space id, from the FetchMyTrackProgress response (D33). */
export function trackProgressBySpaceId (data) {
  const memberships = data?.me?.memberships
  const items = Array.isArray(memberships) ? memberships : memberships?.items || []
  const bySpaceId = {}
  for (const membership of items) {
    const track = membership?.group?.track
    if (!track?.id) continue
    bySpaceId[String(membership.group.id)] = progressFromSettings(track.userSettings, track.numActions, track.didComplete)
  }
  return bySpaceId
}
