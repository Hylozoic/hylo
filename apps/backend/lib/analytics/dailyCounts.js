import { GraphQLError } from 'graphql'
import { EVENT_TYPES } from './trackActivity'
import { addPeriod, parseDay, utcDay, windows } from './periods'

const PERIODS = ['day', 'week', 'month', 'year']
const MAX_POINTS = { day: 400, week: 260, month: 240, year: 20 }
const GROUP_BY = {
  eventType: 'event_type',
  postType: 'post_type',
  platform: 'platform',
  joinSource: 'join_source',
  isPublic: 'is_public'
}
const EVENT_TYPE_VALUES = new Set([...Object.values(EVENT_TYPES), 'visit'])

const COUNT_COLUMNS = 'day, group_id, event_type, post_type, platform, join_source, is_public, events'

// Keep these CASE expressions aligned with how live writes set properties.
const GROUP_SELECT = `
  select (occurred_at at time zone 'UTC')::date as day,
    group_id,
    event_type,
    coalesce(post_type, '') as post_type,
    coalesce(platform, '') as platform,
    case when event_type = 'group_joined' then coalesce(properties->>'source', '') else '' end as join_source,
    case when event_type = 'post_created' and jsonb_exists(properties, 'isPublic') then properties->>'isPublic' else '' end as is_public,
    count(*)::int as events
  from activity_events
  where occurred_at >= ? and occurred_at < ? and group_id <> 0
  group by 1, 2, 3, 4, 5, 6, 7`

const PLATFORM_SELECT = `
  select (occurred_at at time zone 'UTC')::date as day,
    0 as group_id,
    event_type,
    coalesce(post_type, '') as post_type,
    coalesce(platform, '') as platform,
    case when event_type = 'group_joined' then coalesce(properties->>'source', '') else '' end as join_source,
    case when event_type = 'post_created' and jsonb_exists(properties, 'isPublic') then properties->>'isPublic' else '' end as is_public,
    count(distinct object_id)::int as events
  from activity_events
  where occurred_at >= ? and occurred_at < ? and object_id is not null
  group by 1, 3, 4, 5, 6, 7`

const VISIT_SELECT = `
  select day, group_id, 'visit' as event_type, '' as post_type, coalesce(platform, '') as platform,
    '' as join_source, '' as is_public, count(*)::int as events
  from activity_days
  where day >= ?::date and day < ?::date
  group by 1, 2, 5`

/** Last stored day for a range. Today is left out so the read path can count it live. */
export function storedRangeEnd (from, to, today) {
  if (from <= today && to >= today) {
    const yesterday = utcDay(new Date(parseDay(today).getTime() - 24 * 60 * 60 * 1000))
    return yesterday < from ? null : yesterday
  }
  return to
}

/** Columns a caller is allowed to split counts by. Unknown names are rejected. */
export function normalizeGroupBy (groupBy) {
  const columns = []
  for (const key of groupBy || []) {
    if (!GROUP_BY[key]) throw new GraphQLError(`unknown groupBy ${key}`)
    if (!columns.includes(GROUP_BY[key])) columns.push(GROUP_BY[key])
  }
  return columns
}

function assertRange (period, from, to) {
  if (!PERIODS.includes(period)) throw new GraphQLError('period must be day, week, month or year')
  let start
  let end
  try {
    start = parseDay(from)
    end = parseDay(to)
  } catch (err) {
    throw new GraphQLError(err.message)
  }
  if (end < start) throw new GraphQLError('from must be on or before to')
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  const points = period === 'day' ? days : period === 'week' ? days / 7 : period === 'month' ? days / 28 : days / 365
  if (points > MAX_POINTS[period]) throw new GraphQLError('date range is too long')
  return { start, end }
}

function validateFilter (filter) {
  const eventTypes = filter.eventTypes || []
  const unknown = eventTypes.find(type => !EVENT_TYPE_VALUES.has(type))
  if (unknown) throw new GraphQLError(`unknown event type ${unknown}`)
  for (const value of [...(filter.postTypes || []), ...(filter.platforms || []), ...(filter.joinSources || [])]) {
    if (typeof value !== 'string' || value.length > 40) throw new GraphQLError('filter values must be short strings')
  }
}

function filterSql (filter, bindings) {
  const clauses = []
  if (filter.eventTypes && filter.eventTypes.length) {
    clauses.push('event_type = any(?)')
    bindings.push(filter.eventTypes)
  }
  if (filter.postTypes && filter.postTypes.length) {
    clauses.push('post_type = any(?)')
    bindings.push(filter.postTypes)
  }
  if (filter.platforms && filter.platforms.length) {
    clauses.push('platform = any(?)')
    bindings.push(filter.platforms)
  }
  if (filter.joinSources && filter.joinSources.length) {
    clauses.push('join_source = any(?)')
    bindings.push(filter.joinSources)
  }
  if (filter.isPublic === true) clauses.push("is_public = 'true'")
  if (filter.isPublic === false) clauses.push("is_public = 'false'")
  return clauses.length ? ` and ${clauses.join(' and ')}` : ''
}

function dayString (value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function textOrNull (value) {
  return value || null
}

/**
 * Replaces daily counts for [fromDay, toDay). Both arguments are YYYY-MM-DD
 * and toDay is excluded, matching the event backfill windows.
 */
export async function computeDailyCounts (knex, fromDay, toDay) {
  const fromTs = `${fromDay}T00:00:00.000Z`
  const toTs = `${toDay}T00:00:00.000Z`
  await knex('activity_daily_counts').where('day', '>=', fromDay).where('day', '<', toDay).del()
  await knex.raw(`insert into activity_daily_counts (${COUNT_COLUMNS}) ${GROUP_SELECT}`, [fromTs, toTs])
  await knex.raw(`insert into activity_daily_counts (${COUNT_COLUMNS}) ${PLATFORM_SELECT}`, [fromTs, toTs])
  await knex.raw(`insert into activity_daily_counts (${COUNT_COLUMNS}) ${VISIT_SELECT}`, [fromDay, toDay])
}

/** Fills activity_daily_counts for each window from `from` up to `to` (excluded). */
export async function backfillDailyCounts (knex, { from, to, log = () => {} }) {
  const chunks = windows(from, to, 31)
  for (const chunk of chunks) {
    const fromDay = chunk.from.slice(0, 10)
    const toDay = chunk.to.slice(0, 10)
    log(fromDay)
    await computeDailyCounts(knex, fromDay, toDay)
  }
  return chunks.length
}

/**
 * Sums daily counts for one group (group id 0 is the platform). Closed days
 * come from activity_daily_counts. Today is counted from the event log so a
 * dashboard does not wait for the nightly job.
 */
export async function queryActivityCounts (knex, { groupId, filter = {}, groupBy = [], period, from, to, today = utcDay(new Date()) }) {
  assertRange(period, from, to)
  const columns = normalizeGroupBy(groupBy)
  validateFilter(filter)
  const includeToday = from <= today && to >= today
  const tableEnd = storedRangeEnd(from, to, today)
  const bindings = []
  const parts = []

  if (tableEnd) {
    parts.push(`select day, group_id, event_type, post_type, platform, join_source, is_public, events
      from activity_daily_counts
      where day >= ?::date and day <= ?::date`)
    bindings.push(from, tableEnd)
  }

  if (includeToday) {
    const tomorrow = utcDay(addPeriod(parseDay(today), 'day'))
    const fromTs = `${today}T00:00:00.000Z`
    const toTs = `${tomorrow}T00:00:00.000Z`
    parts.push(GROUP_SELECT, PLATFORM_SELECT, VISIT_SELECT)
    bindings.push(fromTs, toTs, fromTs, toTs, today, tomorrow)
  }

  if (!parts.length) return []

  const selectColumns = columns.map(column => column).join(', ')
  const filterBindings = []
  const filters = filterSql(filter, filterBindings)
  bindings.push(String(groupId), from, to, ...filterBindings)

  const sql = `
    with counts as (
      ${parts.join('\n union all ')}
    )
    select date_trunc('${period}', day::timestamp)::date as period_start
      ${selectColumns ? `, ${selectColumns}` : ''},
      sum(events)::float as value
    from counts
    where group_id = ?
      and day >= ?::date and day <= ?::date
      ${filters}
    group by period_start${selectColumns ? `, ${selectColumns}` : ''}
    order by period_start`

  const result = await knex.raw(sql, bindings)
  const rows = result.rows || []
  return rows.map(row => ({
    periodStart: dayString(row.period_start),
    eventType: columns.includes('event_type') ? textOrNull(row.event_type) : null,
    postType: columns.includes('post_type') ? textOrNull(row.post_type) : null,
    platform: columns.includes('platform') ? textOrNull(row.platform) : null,
    joinSource: columns.includes('join_source') ? textOrNull(row.join_source) : null,
    isPublic: columns.includes('is_public') ? (row.is_public === 'true' ? true : row.is_public === 'false' ? false : null) : null,
    value: Number(row.value)
  }))
}

/** Platform counts for Hylo admins, or one group's counts for its stewards. */
export async function readActivityCounts (userId, { groupId, filter, groupBy, period, from, to }) {
  const id = groupId ? String(groupId) : '0'
  if (id === '0') {
    if (!(await Admin.isSuperAdmin(userId))) throw new GraphQLError('Unauthorized')
  } else {
    const allowed = await GroupMembership.hasResponsibility(
      userId, id, Responsibility.constants.RESP_ADMINISTRATION
    )
    if (!allowed) throw new GraphQLError("You don't have permission to view this group's metrics")
  }
  return queryActivityCounts(bookshelf.knex, { groupId: id, filter, groupBy, period, from, to })
}
