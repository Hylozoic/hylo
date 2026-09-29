/* global bookshelf, Group, Track */
/**
 * What people who have not bought access can see of a paid group or space before
 * they buy: titles and counts only, never post bodies, authors or attachments.
 *
 * A steward setting (settings.show_paywall_preview, on unless turned off) controls it.
 * For a space, the parent group's setting applies too, since the Paid Content settings
 * that sell the space live on the parent. The preview also follows group visibility:
 * someone who could not see the group gets nothing.
 */
import { isGroupVisibleToViewer, loadGroupVisibilityContext } from '../../graphql/filters'

export const PREVIEW_POST_LIMIT = 5
export const PREVIEW_ACTION_LIMIT = 50

// Post types whose titles can be shown; chat messages have no title, and
// welcome, notice and message-thread posts are not content to preview
const PREVIEW_POST_TYPES = ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']

/**
 * Whether a group's steward has left the paywall preview on (the default).
 * @param {Group} group
 * @returns {Boolean}
 */
export function showsPaywallPreview (group) {
  const settings = (group && group.get('settings')) || {}
  return settings.show_paywall_preview !== false
}

/**
 * Whether this viewer may see the preview of this group.
 * @param {Group} group
 * @param {String|Number|null} userId - null for someone signed out
 * @returns {Promise<Boolean>}
 */
export async function canSeePaywallPreview (group, userId) {
  if (!group || !group.get('active') || !group.get('paywall')) return false
  if (!showsPaywallPreview(group)) return false

  if (group.get('type') === 'space' && group.get('parent_id')) {
    const parent = await Group.where({ id: group.get('parent_id') }).fetch()
    if (!parent || !showsPaywallPreview(parent)) return false
  }

  const context = userId ? await loadGroupVisibilityContext(userId) : null
  return isGroupVisibleToViewer(group, context, userId)
}

/**
 * Titles of the group's pinned posts, then its most recent posts.
 * @param {Group} group
 * @param {Object} [options]
 * @param {Number} [options.limit]
 * @returns {Promise<String[]>}
 */
export async function previewPostTitles (group, { limit = PREVIEW_POST_LIMIT } = {}) {
  const pinned = await bookshelf.knex('group_view_pins')
    .join('group_views', 'group_views.id', 'group_view_pins.view_id')
    .join('posts', 'posts.id', 'group_view_pins.post_id')
    .where('group_views.group_id', group.id)
    .where('posts.active', true)
    .whereIn('posts.type', PREVIEW_POST_TYPES)
    .orderBy('group_view_pins.pinned_at', 'desc')
    .limit(limit)
    .select('posts.id', 'posts.name')

  const recent = await bookshelf.knex('posts')
    .join('groups_posts', 'groups_posts.post_id', 'posts.id')
    .where('groups_posts.group_id', group.id)
    .where('posts.active', true)
    .whereIn('posts.type', PREVIEW_POST_TYPES)
    .orderBy('posts.created_at', 'desc')
    .limit(limit)
    .select('posts.id', 'posts.name')

  const seen = new Set()
  const titles = []
  for (const row of pinned.concat(recent)) {
    const title = (row.name || '').trim()
    if (!title || seen.has(String(row.id))) continue
    seen.add(String(row.id))
    titles.push(title)
    if (titles.length >= limit) break
  }
  return titles
}

/**
 * For a track space: the titles of its actions (still locked to the viewer),
 * how many actions there are and how many people have completed the track.
 * @param {Group} group
 * @returns {Promise<{ actionTitles: String[], numActions: Number, numPeopleCompleted: Number }|null>}
 */
export async function trackPreview (group) {
  const trackId = group.get('track_id')
  if (!trackId) return null
  const track = await Track.where({ id: trackId }).fetch()
  if (!track || track.get('deactivated_at')) return null

  const actions = await group.actionPosts()
  const actionTitles = actions
    .map(post => (post.get('name') || '').trim())
    .filter(Boolean)
    .slice(0, PREVIEW_ACTION_LIMIT)

  return {
    actionTitles,
    numActions: track.get('num_actions') ?? actions.length,
    numPeopleCompleted: track.get('num_people_completed') || 0
  }
}

/**
 * The preview for this viewer, or null when there is none to show.
 * @param {Group} group
 * @param {String|Number|null} userId
 * @returns {Promise<{ postTitles: String[], actionTitles: String[], numActions: Number|null, numPeopleCompleted: Number|null }|null>}
 */
export async function paywallPreview (group, userId) {
  if (!await canSeePaywallPreview(group, userId)) return null

  const track = await trackPreview(group)
  if (track) {
    return { postTitles: [], ...track }
  }

  return {
    postTitles: await previewPostTitles(group),
    actionTitles: [],
    numActions: null,
    numPeopleCompleted: null
  }
}
