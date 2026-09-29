/* global bookshelf, Activity, sails */
/*
  D49, run as an experiment: when a newcomer's first post in a group has had no
  comment and no reaction for a day, nudge the group's stewards (Administrators,
  Moderators and Hosts, group/stewardAudience.js) in-app, and list the post in the
  weekly steward email (lib/group/stewardDigest.js).

  Being new is measured on the top-level group, since a space's members come from
  its group: a long-time member who joins a space and posts there isn't new.
  - A newcomer joined the top-level group at most NEWCOMER_DAYS before posting, and
    didn't create it.
  - Their first post there is a feed post (not a chat, a chat notice, a direct message
    or a welcome post) with no earlier active feed post by them in the group or any
    of its spaces.
  - It is between MIN_AGE_HOURS and MAX_AGE_HOURS old, so a daily run sees each post
    once, and nobody else has commented on it or reacted to it.
  - A post shared to the group and one of its spaces is counted once, under the group.

  Newcomers are bucketed with lib/experiments.js FIRST_POST_NUDGE. Every eligible post
  gets one first_post_nudges row with the newcomer's arm and steward_count, how many
  stewards the post's group has to tell. In the 'nudge' arm those stewards get the
  notice and nudged_at is set; with no steward to tell, nudged_at stays empty. The
  analysis compares the arms on rows with steward_count > 0, to see whether newcomers
  post a second time. The unique row per post and group means one nudge per post,
  even when runs overlap.
*/
import { FIRST_POST_NUDGE, assign } from '../../../lib/experiments'
import { stewardIds } from '../group/stewardAudience'
import sentry from '../../../lib/sentry'

export const REASON = 'firstPostUnanswered'
export const NUDGE_VARIANT = 'nudge'
export const MIN_AGE_HOURS = 24
export const MAX_AGE_HOURS = 48
export const NEWCOMER_DAYS = 30
export const MAX_POSTS_PER_RUN = 500
export const NOT_FEED_TYPES = ['chat', 'chat_activity', 'thread', 'welcome']

const HOUR_MS = 60 * 60 * 1000

const feedPost = alias =>
  `${alias}.active = true AND (${alias}.type IS NULL OR ${alias}.type NOT IN (${NOT_FEED_TYPES.map(t => `'${t}'`).join(', ')}))`

/**
 * Newcomers' first posts that are due a check now and have no response, as
 * { postId, groupId, userId }, oldest first.
 */
export async function unansweredFirstPosts ({ now = new Date(), limit = MAX_POSTS_PER_RUN } = {}) {
  const { rows } = await bookshelf.knex.raw(`
    SELECT post_id, group_id, user_id FROM (
      SELECT DISTINCT ON (p.id, root.id) p.id AS post_id, g.id AS group_id, p.user_id, p.created_at
      FROM posts p
      JOIN groups_posts gp ON gp.post_id = p.id
      JOIN groups g ON g.id = gp.group_id AND g.active = true
      JOIN groups root ON root.id = COALESCE(g.parent_id, g.id) AND root.active = true
      JOIN group_memberships gm ON gm.group_id = root.id AND gm.user_id = p.user_id AND gm.active = true
      JOIN users u ON u.id = p.user_id AND u.active = true
      WHERE ${feedPost('p')}
        AND p.created_at <= ? AND p.created_at > ?
        AND gm.created_at > p.created_at - (? * interval '1 day')
        AND COALESCE(gm.settings->>'joinSource', '') <> 'creator'
        AND NOT EXISTS (
          SELECT 1 FROM posts earlier
          JOIN groups_posts egp ON egp.post_id = earlier.id
          JOIN groups eg ON eg.id = egp.group_id AND (eg.id = root.id OR eg.parent_id = root.id)
          WHERE earlier.user_id = p.user_id AND ${feedPost('earlier')}
            AND (earlier.created_at < p.created_at OR (earlier.created_at = p.created_at AND earlier.id < p.id))
        )
        AND NOT EXISTS (
          SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.active = true AND c.user_id <> p.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM reactions r WHERE r.entity_type = 'post' AND r.entity_id = p.id AND r.user_id <> p.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM first_post_nudges n
          JOIN groups ng ON ng.id = n.group_id
          WHERE n.post_id = p.id AND COALESCE(ng.parent_id, ng.id) = root.id
        )
      ORDER BY p.id, root.id, (g.id = root.id) DESC, g.id
    ) firsts
    ORDER BY created_at, post_id, group_id
    LIMIT ?
  `, [
    new Date(now.getTime() - MIN_AGE_HOURS * HOUR_MS),
    new Date(now.getTime() - MAX_AGE_HOURS * HOUR_MS),
    NEWCOMER_DAYS,
    limit
  ])
  return rows.map(row => ({ postId: String(row.post_id), groupId: String(row.group_id), userId: String(row.user_id) }))
}

// Records the post for this group once; false when it was already recorded
async function record ({ postId, groupId, userId, variant, stewardCount, nudgedAt, now }) {
  const { rows } = await bookshelf.knex.raw(`
    INSERT INTO first_post_nudges (post_id, group_id, user_id, variant, steward_count, nudged_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (post_id, group_id) DO NOTHING
    RETURNING id
  `, [postId, groupId, userId, variant, stewardCount, nudgedAt, now])
  return rows.length > 0
}

/**
 * The daily run (cron.js). Returns { found, nudged, control }. One post that fails is
 * logged and skipped, so it doesn't stop the rest.
 */
export async function runDaily ({ now = new Date(), limit = MAX_POSTS_PER_RUN } = {}) {
  const posts = await unansweredFirstPosts({ now, limit })
  let nudged = 0
  let control = 0
  for (const { postId, groupId, userId } of posts) {
    try {
      const variant = await assign(FIRST_POST_NUDGE, userId)
      const readers = await stewardIds(groupId, { excludeUserIds: [userId] })
      const nudge = variant === NUDGE_VARIANT && readers.length > 0
      if (!await record({ postId, groupId, userId, variant, stewardCount: readers.length, nudgedAt: nudge ? now : null, now })) continue
      if (variant !== NUDGE_VARIANT) {
        control += 1
        continue
      }
      if (!nudge) continue
      await Activity.saveForReasons(readers.map(readerId => ({
        actor_id: userId,
        reader_id: readerId,
        post_id: postId,
        group_id: groupId,
        reason: REASON
      })))
      nudged += 1
    } catch (err) {
      sails.log.error(`First-post nudge failed for post ${postId} in group ${groupId}: ${err.message}`, err.stack)
      sentry.captureException(err, { extra: { job: 'firstPostNudge', postId, groupId } })
    }
  }
  return { found: posts.length, nudged, control }
}

/**
 * Nudged newcomers' first posts in these groups since `since` that still have no
 * comment or reaction from someone else, for the weekly steward email, newest first.
 */
export async function stillUnanswered (groupIds, { since, limit = 10 } = {}) {
  if (groupIds.length === 0) return []
  const { rows } = await bookshelf.knex.raw(`
    SELECT DISTINCT ON (p.id) p.id AS post_id, n.group_id, p.user_id, n.nudged_at
    FROM first_post_nudges n
    JOIN posts p ON p.id = n.post_id AND p.active = true
    WHERE n.group_id IN (${groupIds.map(() => '?').join(', ')}) AND n.variant = ? AND n.nudged_at > ?
      AND NOT EXISTS (
        SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.active = true AND c.user_id <> p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM reactions r WHERE r.entity_type = 'post' AND r.entity_id = p.id AND r.user_id <> p.user_id
      )
    ORDER BY p.id, n.nudged_at DESC
  `, [...groupIds, NUDGE_VARIANT, since])
  return rows
    .sort((a, b) => new Date(b.nudged_at) - new Date(a.nudged_at))
    .slice(0, limit)
    .map(row => ({ postId: String(row.post_id), groupId: String(row.group_id), userId: String(row.user_id) }))
}
