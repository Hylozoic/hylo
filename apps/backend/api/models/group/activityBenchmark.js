/* global bookshelf, sails */
// Marks each group and space quiet or busy, so "Important" can include every feed post
// in quiet places (D94, see notification/rules/adaptiveImportant).
//
// A place is quiet when it had fewer feed posts in the last MEASURE_DAYS than the
// quiet line. Feed posts are posts other than chats, chat notices and direct message
// threads. Groups and spaces are measured separately. The daily job writes
// groups.settings.below_activity_benchmark (plus when it was measured and the count),
// so the notification path reads a flag rather than counting.
//
// The line adapts: every RECALCULATE_EVERY_DAYS it becomes the highest MEASURE_DAYS
// feed-post count among healthy groups, kept within QUIET_LINE_MIN..QUIET_LINE_MAX. A
// healthy group has at least HEALTHY_MIN_MEMBERS active members, and in at least
// HEALTHY_MIN_ACTIVE_WEEKS of the last HEALTHY_LOOKBACK_WEEKS weeks at least
// HEALTHY_ACTIVE_SHARE of its members acted (posted, commented, chatted or reacted).
// When no group qualifies, the previous line stays (QUIET_LINE_DEFAULT at first). The
// line lives in Redis, with QUIET_LINE_DEFAULT as the fallback.
import RedisClient from '../../services/RedisClient'

export const MEASURE_DAYS = 28
export const QUIET_LINE_DEFAULT = 28
export const QUIET_LINE_MIN = 14
export const QUIET_LINE_MAX = 56
export const RECALCULATE_EVERY_DAYS = 30

export const HEALTHY_MIN_MEMBERS = 10
export const HEALTHY_ACTIVE_SHARE = 0.1
export const HEALTHY_MIN_ACTIVE_WEEKS = 7
export const HEALTHY_LOOKBACK_WEEKS = 12

export const QUIET_LINE_REDIS_KEY = 'activityBenchmark.quietLine'

const NOT_FEED_TYPES = ['chat', 'chat_activity', 'thread']
const DAY_MS = 24 * 60 * 60 * 1000

const clampLine = n => Math.min(QUIET_LINE_MAX, Math.max(QUIET_LINE_MIN, n))

const feedPostCondition = alias =>
  `${alias}.active = true AND (${alias}.type IS NULL OR ${alias}.type NOT IN (${NOT_FEED_TYPES.map(t => `'${t}'`).join(', ')}))`

export async function readStoredLine () {
  try {
    const raw = await RedisClient.create().get(QUIET_LINE_REDIS_KEY)
    const stored = raw ? JSON.parse(raw) : null
    if (stored && Number.isFinite(stored.line)) return stored
  } catch (err) {
    sails.log.error(`activityBenchmark: could not read the quiet line: ${err.message}`)
  }
  return null
}

export async function quietLine () {
  const stored = await readStoredLine()
  return stored ? stored.line : QUIET_LINE_DEFAULT
}

async function storeLine (value) {
  await RedisClient.create().set(QUIET_LINE_REDIS_KEY, JSON.stringify(value))
}

// The highest MEASURE_DAYS feed-post count among healthy groups, or null when none
// qualifies.
export async function busiestHealthyGroupCount (now = new Date()) {
  const lookbackStart = new Date(now.getTime() - HEALTHY_LOOKBACK_WEEKS * 7 * DAY_MS)
  const measureStart = new Date(now.getTime() - MEASURE_DAYS * DAY_MS)
  const { rows } = await bookshelf.knex.raw(`
    WITH members AS (
      SELECT gm.group_id, count(*) AS n
      FROM group_memberships gm
      JOIN groups g ON g.id = gm.group_id AND g.active = true
      WHERE gm.active = true
      GROUP BY gm.group_id
      HAVING count(*) >= :minMembers
    ),
    acts AS (
      SELECT gp.group_id, p.user_id, p.created_at AS at
      FROM posts p JOIN groups_posts gp ON gp.post_id = p.id
      WHERE p.active = true AND p.created_at >= :lookbackStart AND p.created_at <= :now
        AND gp.group_id IN (SELECT group_id FROM members)
      UNION ALL
      SELECT gp.group_id, c.user_id, c.created_at
      FROM comments c JOIN groups_posts gp ON gp.post_id = c.post_id
      WHERE c.active = true AND c.created_at >= :lookbackStart AND c.created_at <= :now
        AND gp.group_id IN (SELECT group_id FROM members)
      UNION ALL
      SELECT gp.group_id, r.user_id, r.date_reacted
      FROM reactions r JOIN groups_posts gp ON gp.post_id = r.entity_id
      WHERE r.entity_type = 'post' AND r.date_reacted >= :lookbackStart AND r.date_reacted <= :now
        AND gp.group_id IN (SELECT group_id FROM members)
      UNION ALL
      SELECT gp.group_id, r.user_id, r.date_reacted
      FROM reactions r
      JOIN comments c ON c.id = r.entity_id
      JOIN groups_posts gp ON gp.post_id = c.post_id
      WHERE r.entity_type = 'comment' AND r.date_reacted >= :lookbackStart AND r.date_reacted <= :now
        AND gp.group_id IN (SELECT group_id FROM members)
    ),
    weekly AS (
      SELECT a.group_id, floor(extract(epoch FROM (:now::timestamptz - a.at)) / 604800) AS week,
        count(DISTINCT a.user_id) AS actors
      FROM acts a
      JOIN group_memberships gm ON gm.group_id = a.group_id AND gm.user_id = a.user_id AND gm.active = true
      GROUP BY 1, 2
    ),
    healthy AS (
      SELECT w.group_id
      FROM weekly w JOIN members m ON m.group_id = w.group_id
      WHERE w.week < :weeks AND w.actors >= m.n * :share::numeric
      GROUP BY w.group_id
      HAVING count(*) >= :minWeeks
    )
    SELECT max(feed.n)::int AS busiest, count(*)::int AS healthy
    FROM healthy h
    CROSS JOIN LATERAL (
      SELECT count(*) AS n
      FROM groups_posts gp JOIN posts p ON p.id = gp.post_id
      WHERE gp.group_id = h.group_id AND ${feedPostCondition('p')}
        AND p.created_at >= :measureStart AND p.created_at <= :now
    ) feed
  `, {
    minMembers: HEALTHY_MIN_MEMBERS,
    share: HEALTHY_ACTIVE_SHARE,
    minWeeks: HEALTHY_MIN_ACTIVE_WEEKS,
    weeks: HEALTHY_LOOKBACK_WEEKS,
    lookbackStart,
    measureStart,
    now
  })
  const { busiest, healthy } = rows[0] || {}
  return healthy > 0 ? { busiest: busiest || 0, healthy } : null
}

// Recomputes the line from healthy groups and stores it. Keeps the previous line when
// no group qualifies.
export async function recalculateQuietLine (now = new Date()) {
  const previous = await readStoredLine()
  const result = await busiestHealthyGroupCount(now)
  const line = result
    ? clampLine(result.busiest)
    : (previous ? previous.line : QUIET_LINE_DEFAULT)
  const stored = { line, computedAt: now.toISOString(), healthyGroups: result ? result.healthy : 0 }
  await storeLine(stored)
  return stored
}

// Writes each active group's and space's quiet flag for the given line in one update.
export async function markGroups (line, now = new Date()) {
  const measureStart = new Date(now.getTime() - MEASURE_DAYS * DAY_MS)
  const result = await bookshelf.knex.raw(`
    UPDATE groups g
    SET settings = coalesce(g.settings, '{}'::jsonb) || jsonb_build_object(
      'below_activity_benchmark', counts.n < :line,
      'feed_posts_last_28_days', counts.n,
      'activity_benchmark_measured_at', :measuredAt::text
    )
    FROM (
      SELECT g2.id, (
        SELECT count(*)
        FROM groups_posts gp JOIN posts p ON p.id = gp.post_id
        WHERE gp.group_id = g2.id AND ${feedPostCondition('p')}
          AND p.created_at >= :measureStart AND p.created_at <= :now
      )::int AS n
      FROM groups g2
      WHERE g2.active = true
    ) counts
    WHERE g.id = counts.id
  `, { line, measureStart, now, measuredAt: now.toISOString() })
  return result.rowCount
}

const isDue = (stored, now) =>
  !stored || !stored.computedAt ||
  now - new Date(stored.computedAt) >= RECALCULATE_EVERY_DAYS * DAY_MS

// Daily cron entry: recompute the line when it is due (monthly), then mark every group.
export async function runDaily (now = new Date()) {
  const stored = await readStoredLine()
  const { line } = isDue(stored, now) ? await recalculateQuietLine(now) : stored
  const marked = await markGroups(line, now)
  return { line, marked }
}
