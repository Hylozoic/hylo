import { addPeriod, parseDay, utcDay } from './periods'

// The Axolotl bot. Kept here so the cron and the CLI can run without Sails.
export const AXOLOTL_ID = 13986

export const METRIC_IDS = [
  'active_users', 'wau', 'mau', 'contributors', 'connected_members',
  'posts', 'comments', 'reactions', 'rsvps', 'votes', 'messages',
  'joins', 'signups', 'members', 'open_join_requests',
  'contributor_cohort', 'contributor_retained'
]

const CONTRIBUTION = `
  event_type in ('post_created','comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
  and coalesce(post_type, '') not in ('thread','chat_activity','welcome')
  and user_id <> ${AXOLOTL_ID}`

const CONNECTION = `
  event_type in ('comment_created','reaction_added','event_rsvp','proposal_vote','project_joined')
  and coalesce(post_type, '') not in ('thread','chat_activity','welcome')
  and target_user_id is not null and target_user_id <> user_id
  and user_id <> ${AXOLOTL_ID}`

/** Inserts or overwrites snapshot rows. */
async function writeRows (knex, rows) {
  const prepared = rows.filter(row => row.value !== null && row.value !== undefined)
  for (let i = 0; i < prepared.length; i += 500) {
    // Knex 0.21 treats merge(['col']) as updates to columns named "0", "1".
    // merge() with no arguments copies every inserted column from excluded.
    await knex('metric_snapshots')
      .insert(prepared.slice(i, i + 500))
      .onConflict(['group_id', 'metric', 'period', 'period_start', 'dimension'])
      .merge()
  }
}

/** Runs a query that returns group_id and value, and stores one snapshot per group. */
async function store (knex, { sql, bindings, metric, period, periodStart, dimension = '' }) {
  const result = await knex.raw(sql, bindings)
  const now = new Date()
  await writeRows(knex, (result.rows || []).map(row => ({
    group_id: row.group_id,
    metric,
    dimension: row.dimension === undefined || row.dimension === null ? dimension : String(row.dimension),
    period,
    period_start: periodStart,
    value: row.value,
    computed_at: now
  })))
}

/** Counts an event type per group, plus one platform row (group 0) of distinct objects. */
function eventCountSql (eventType, { distinct = false } = {}) {
  const perGroup = `select group_id, count(*)::int as value from activity_events
    where event_type = '${eventType}' and occurred_at >= ? and occurred_at < ? and user_id <> ${AXOLOTL_ID} and group_id <> 0
    group by group_id`
  const platform = distinct
    ? `select 0 as group_id, count(distinct object_id)::int as value from activity_events
        where event_type = '${eventType}' and occurred_at >= ? and occurred_at < ? and user_id <> ${AXOLOTL_ID}`
    : `select 0 as group_id, count(*)::int as value from activity_events
        where event_type = '${eventType}' and occurred_at >= ? and occurred_at < ? and user_id <> ${AXOLOTL_ID}`
  return `${perGroup} union all ${platform}`
}

/**
 * Computes every activity metric for one closed period and writes it to
 * metric_snapshots. `rolling` adds 7-day and 30-day audience totals for a day.
 * `state` records current membership and join-request counts. `retention`
 * records who contributed again the week after they contributed.
 */
export async function computePeriod (knex, { period, periodStart, rolling = false, state = false, retention = false }) {
  const start = parseDay(periodStart)
  const end = addPeriod(start, period)
  const range = [start.toISOString(), end.toISOString()]
  const dayRange = [utcDay(start), utcDay(end)]

  await store(knex, {
    metric: 'active_users',
    period,
    periodStart,
    bindings: dayRange,
    sql: `select group_id, count(distinct user_id)::int as value from activity_days
      where day >= ? and day < ? and user_id <> ${AXOLOTL_ID} group by group_id`
  })

  if (rolling && period === 'day') {
    await store(knex, {
      metric: 'wau',
      period,
      periodStart,
      bindings: [periodStart, periodStart],
      sql: `select group_id, count(distinct user_id)::int as value from activity_days
        where day > (?::date - interval '7 days') and day <= ?::date and user_id <> ${AXOLOTL_ID} group by group_id`
    })
    await store(knex, {
      metric: 'mau',
      period,
      periodStart,
      bindings: [periodStart, periodStart],
      sql: `select group_id, count(distinct user_id)::int as value from activity_days
        where day > (?::date - interval '30 days') and day <= ?::date and user_id <> ${AXOLOTL_ID} group by group_id`
    })
  }

  await store(knex, {
    metric: 'contributors',
    period,
    periodStart,
    bindings: [...range, ...range],
    sql: `select group_id, count(distinct user_id)::int as value from activity_events
      where ${CONTRIBUTION} and occurred_at >= ? and occurred_at < ? and group_id <> 0 group by group_id
      union all
      select 0, count(distinct user_id)::int from activity_events
      where ${CONTRIBUTION} and occurred_at >= ? and occurred_at < ?`
  })

  await store(knex, {
    metric: 'connected_members',
    period,
    periodStart,
    bindings: [...range, ...range, ...range, ...range],
    sql: `select group_id, count(distinct person)::int as value from (
        select group_id, user_id as person from activity_events
          where ${CONNECTION} and occurred_at >= ? and occurred_at < ? and group_id <> 0
        union
        select group_id, target_user_id from activity_events
          where ${CONNECTION} and occurred_at >= ? and occurred_at < ? and group_id <> 0
      ) people group by group_id
      union all
      select 0, count(distinct person)::int from (
        select user_id as person from activity_events where ${CONNECTION} and occurred_at >= ? and occurred_at < ?
        union
        select target_user_id from activity_events where ${CONNECTION} and occurred_at >= ? and occurred_at < ?
      ) people`
  })

  for (const [metric, eventType, distinct] of [
    ['posts', 'post_created', true],
    ['comments', 'comment_created', true],
    ['reactions', 'reaction_added', true],
    ['rsvps', 'event_rsvp', true],
    ['votes', 'proposal_vote', true],
    ['messages', 'message_sent', true],
    ['joins', 'group_joined', false],
    ['signups', 'signup_completed', true]
  ]) {
    await store(knex, {
      metric,
      period,
      periodStart,
      bindings: [...range, ...range],
      sql: eventCountSql(eventType, { distinct })
    })
  }

  if (retention && period === 'week') {
    const previous = new Date(start.getTime())
    previous.setUTCDate(previous.getUTCDate() - 7)
    const previousWindow = [previous.toISOString(), start.toISOString()]
    await store(knex, {
      metric: 'contributor_cohort',
      period,
      periodStart,
      bindings: [...previousWindow, ...previousWindow],
      sql: `select group_id, count(distinct user_id)::int as value from activity_events
        where ${CONTRIBUTION} and occurred_at >= ? and occurred_at < ? and group_id <> 0 group by group_id
        union all
        select 0, count(distinct user_id)::int from activity_events
        where ${CONTRIBUTION} and occurred_at >= ? and occurred_at < ?`
    })
    await store(knex, {
      metric: 'contributor_retained',
      period,
      periodStart,
      bindings: [...range, ...previousWindow, ...range, ...previousWindow],
      sql: `select prev.group_id, count(distinct curr.user_id)::int as value from activity_events prev
        join activity_events curr
          on curr.user_id = prev.user_id and curr.group_id = prev.group_id
          and ${CONTRIBUTION.replace(/event_type/g, 'curr.event_type').replace(/post_type/g, 'curr.post_type').replace(/user_id/g, 'curr.user_id')}
          and curr.occurred_at >= ? and curr.occurred_at < ?
        where ${CONTRIBUTION.replace(/event_type/g, 'prev.event_type').replace(/post_type/g, 'prev.post_type').replace(/user_id/g, 'prev.user_id')}
          and prev.occurred_at >= ? and prev.occurred_at < ? and prev.group_id <> 0
        group by prev.group_id
        union all
        select 0, count(distinct curr.user_id)::int from activity_events prev
        join activity_events curr
          on curr.user_id = prev.user_id
          and ${CONTRIBUTION.replace(/event_type/g, 'curr.event_type').replace(/post_type/g, 'curr.post_type').replace(/user_id/g, 'curr.user_id')}
          and curr.occurred_at >= ? and curr.occurred_at < ?
        where ${CONTRIBUTION.replace(/event_type/g, 'prev.event_type').replace(/post_type/g, 'prev.post_type').replace(/user_id/g, 'prev.user_id')}
          and prev.occurred_at >= ? and prev.occurred_at < ?`
    })
  }

  if (state) {
    await store(knex, {
      metric: 'members',
      period,
      periodStart,
      bindings: [],
      sql: `select group_id, count(*)::int as value from group_memberships
        where active and user_id <> ${AXOLOTL_ID} group by group_id
        union all
        select 0, count(distinct user_id)::int from group_memberships where active and user_id <> ${AXOLOTL_ID}`
    })
    await store(knex, {
      metric: 'open_join_requests',
      period,
      periodStart,
      bindings: [],
      sql: `select group_id, count(*)::int as value from join_requests where status = 0 group by group_id
        union all
        select 0, count(*)::int from join_requests where status = 0`
    })
  }
}

/**
 * Closes yesterday (UTC): its day, and the week, month or year that ended
 * yesterday. Membership counts are whatever they are when this runs.
 */
export async function computeDueSnapshots (knex, now = new Date()) {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  await computePeriod(knex, { period: 'day', periodStart: utcDay(yesterday), rolling: true, state: true })

  if (yesterday.getUTCDay() === 0) {
    const monday = new Date(yesterday.getTime())
    monday.setUTCDate(monday.getUTCDate() - 6)
    await computePeriod(knex, { period: 'week', periodStart: utcDay(monday), retention: true })
  }

  const next = addPeriod(yesterday, 'day')
  if (next.getUTCDate() === 1) {
    const monthStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 1))
    await computePeriod(knex, { period: 'month', periodStart: utcDay(monthStart) })
    if (next.getUTCMonth() === 0) {
      await computePeriod(knex, { period: 'year', periodStart: `${yesterday.getUTCFullYear()}-01-01` })
    }
  }
}

/**
 * Recomputes day, week, month and year snapshots from `from` up to `to`.
 * Skips a week, month or year that is still in progress.
 */
export async function backfillSnapshots (knex, { from, to }) {
  const start = parseDay(from)
  const end = parseDay(to)
  for (let cursor = new Date(start.getTime()); cursor < end; cursor = addPeriod(cursor, 'day')) {
    await computePeriod(knex, { period: 'day', periodStart: utcDay(cursor), rolling: true })
  }
  for (let cursor = new Date(start.getTime()); cursor < end; cursor = addPeriod(cursor, 'day')) {
    if (cursor.getUTCDay() !== 1) continue
    const weekEnd = addPeriod(cursor, 'week')
    if (weekEnd <= end) await computePeriod(knex, { period: 'week', periodStart: utcDay(cursor), retention: true })
  }
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(Date.UTC(year, month, 1))
      const monthEnd = addPeriod(monthStart, 'month')
      if (monthStart >= start && monthEnd <= end) {
        await computePeriod(knex, { period: 'month', periodStart: utcDay(monthStart) })
      }
    }
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = addPeriod(yearStart, 'year')
    if (yearStart >= start && yearEnd <= end) {
      await computePeriod(knex, { period: 'year', periodStart: utcDay(yearStart) })
    }
  }
}
