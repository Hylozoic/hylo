/* global bookshelf, Responsibility */
// D63: a learner's progress in a track is recorded on their track-space membership
// (settings.actionsCompleted and settings.lastActionAt, by Post.checkCompletedTrack).
// It is shown to the learner and to the track's stewards.

// Responsibilities (in the track's role scope, the parent group) that can see every
// learner's progress: the same people who can see who completed a track
export const PROGRESS_VIEWER_RESPONSIBILITIES = [
  'Administration',
  'Manage Tracks',
  'Manage Content',
  'Remove Members',
  'Add Members'
]

/**
 * For each space id: whether it is a track space, and whether the viewer may see its
 * learners' progress. Deduplicates, so each space is checked once.
 * @returns {Promise<Map<string, { isTrack: boolean, canSeeAll: boolean }>>}
 */
export async function learnerProgressAccess (viewerId, spaceIds) {
  const unique = [...new Set((spaceIds || []).filter(id => id != null).map(String))]
  const result = new Map(unique.map(id => [id, { isTrack: false, canSeeAll: false }]))
  if (!viewerId || unique.length === 0) return result

  const trackSpaceIds = (await bookshelf.knex('groups')
    .whereIn('id', unique)
    .whereNotNull('track_id')
    .pluck('id')).map(String)

  await Promise.all(trackSpaceIds.map(async spaceId => {
    const titles = await Responsibility.fetchForUserAndGroupAsStrings(viewerId, spaceId)
    result.set(spaceId, {
      isTrack: true,
      canSeeAll: titles.some(title => PROGRESS_VIEWER_RESPONSIBILITIES.includes(title))
    })
  }))
  return result
}

/** Progress fields from a track-space membership's settings. */
export function progressFromMembershipSettings (settings) {
  return {
    actionsCompleted: Number(settings?.actionsCompleted) || 0,
    lastActionAt: settings?.lastActionAt || null
  }
}

/** Narrows Track#enrolledUsers to learners who have (true) or haven't (false) finished. */
export function filterEnrolledByCompletion (relation, completed) {
  if (completed == null) return relation
  return relation.query(q => {
    if (completed) {
      q.whereRaw('group_memberships.settings ->> \'completedAt\' IS NOT NULL')
    } else {
      q.whereRaw('group_memberships.settings ->> \'completedAt\' IS NULL')
    }
  })
}
