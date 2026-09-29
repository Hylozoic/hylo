/* global bookshelf, Responsibility */
// D63: a learner's progress in a track is recorded on their track-space membership
// (settings.actionsCompleted and settings.lastActionAt, by Post.checkCompletedTrack).
// It is shown to the learner and to the track's stewards. The person who created the
// track space is a member of it too, but not a learner: see learnerMembershipSql.

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

// Joining a track space makes someone enrolled, but the person who created the space
// (and stewards copied in when a group becomes a space) are members without having
// enrolled. Memberships from before join sources were recorded have none; for those,
// the space's creator is the one to leave out.
const SETUP_JOIN_SOURCES = ['creator', 'space']

/**
 * SQL condition (for a group_memberships alias) that is true for learners: members of
 * a track space other than the people who set the space up.
 */
export function learnerMembershipSql (alias = 'group_memberships') {
  const joinSource = `${alias}.settings ->> 'joinSource'`
  return `NOT (
    COALESCE(${joinSource}, '') IN (${SETUP_JOIN_SOURCES.map(source => `'${source}'`).join(', ')})
    OR (${joinSource} IS NULL AND EXISTS (
      SELECT 1 FROM groups setup_space
      WHERE setup_space.id = ${alias}.group_id AND setup_space.created_by_id = ${alias}.user_id
    ))
  )`
}

/**
 * Narrows Track#enrolledUsers to learners who have (completed true) or haven't (false)
 * finished, and with learnersOnly to learners, leaving out whoever set the space up.
 */
export function filterEnrolledByCompletion (relation, completed, { learnersOnly = false } = {}) {
  if (completed == null && !learnersOnly) return relation
  return relation.query(q => {
    if (completed === true) {
      q.whereRaw('group_memberships.settings ->> \'completedAt\' IS NOT NULL')
    } else if (completed === false) {
      q.whereRaw('group_memberships.settings ->> \'completedAt\' IS NULL')
    }
    if (learnersOnly) q.whereRaw(learnerMembershipSql('group_memberships'))
  })
}
