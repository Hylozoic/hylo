import { createHash } from 'crypto'
import { GraphQLError } from 'graphql'
import { addPeriod, parseDay, startOfWeek, utcDay } from '../periods'

export const RETENTION_STARTS = ['signup', 'first_contribution', 'first_post', 'group_joined']
export const RETENTION_RETURNS = ['contribution', 'visit', 'post', 'comment', 'group_joined']

const running = new Map()

/**
 * Checks a retention question and clamps it to 24 cohorts by 12 return periods.
 */
export function validateRetention ({ start, returning, period, cohorts = 12, periods = 8 }) {
  if (!RETENTION_STARTS.includes(start)) throw new GraphQLError('Unknown starting point')
  if (!RETENTION_RETURNS.includes(returning)) throw new GraphQLError('Unknown return activity')
  if (!['day', 'week', 'month'].includes(period)) throw new GraphQLError('period must be day, week or month')
  const cohortCount = Math.min(24, Math.max(1, Math.floor(Number(cohorts)) || 1))
  const periodCount = Math.min(12, Math.max(1, Math.floor(Number(periods)) || 1))
  return { start, returning, period, cohorts: cohortCount, periods: periodCount }
}

/** The activity that counts as someone coming back, for one return window. */
function returnSql (returning, index, period, groupId) {
  const group = groupId ? 'and a.group_id = ?' : ''
  if (returning === 'visit') {
    return `select 1 from activity_days a where a.user_id = m.user_id ${group}
      and a.day >= (m.occurred_on + (${index} * interval '1 ${period}'))::date
      and a.day < (m.occurred_on + (${index + 1} * interval '1 ${period}'))::date`
  }
  if (returning === 'group_joined') {
    return `select 1 from user_milestones j where j.user_id = m.user_id and j.milestone = 'group_joined'
      ${groupId ? 'and j.group_id = ?' : ''}
      and j.occurred_on >= (m.occurred_on + (${index} * interval '1 ${period}'))::date
      and j.occurred_on < (m.occurred_on + (${index + 1} * interval '1 ${period}'))::date`
  }
  const column = returning === 'post' ? 'a.posts > 0' : returning === 'comment' ? 'a.comments > 0' : '(a.posts + a.comments + a.reactions + a.rsvps + a.votes + a.project_joins) > 0'
  return `select 1 from user_day_activity a where a.user_id = m.user_id and ${column} ${group}
    and a.day >= (m.occurred_on + (${index} * interval '1 ${period}'))::date
    and a.day < (m.occurred_on + (${index + 1} * interval '1 ${period}'))::date`
}

/**
 * Runs one retention question. Closed ranges are reused. One question runs at a
 * time per person, in a read-only transaction that stops after 10 seconds.
 */
export async function exploreRetention (knex, userId, input) {
  const key = String(userId || '0')
  if (running.has(key)) throw new GraphQLError('A retention query is already running')
  const job = runRetention(knex, input).finally(() => running.delete(key))
  running.set(key, job)
  return job
}

/** Builds and runs the retention query, using the cache when every cohort is closed. */
async function runRetention (knex, input) {
  const question = validateRetention(input)
  const groupId = Number(input.groupId) || 0
  const today = new Date()
  const cursor = question.period === 'week'
    ? startOfWeek(today)
    : question.period === 'month'
      ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const from = new Date(cursor.getTime())
  for (let i = 0; i < question.cohorts; i++) {
    if (question.period === 'day') from.setUTCDate(from.getUTCDate() - 1)
    else if (question.period === 'week') from.setUTCDate(from.getUTCDate() - 7)
    else from.setUTCMonth(from.getUTCMonth() - 1)
  }
  let lastReturn = new Date(cursor.getTime())
  for (let i = 0; i < question.periods; i++) lastReturn = addPeriod(lastReturn, question.period)
  const closed = lastReturn <= today
  const cacheKey = createHash('sha256').update(JSON.stringify({ ...question, groupId, from: utcDay(from), to: utcDay(cursor) })).digest('hex')

  if (closed) {
    const cached = await knex('retention_cache').where({ cache_key: cacheKey }).first()
    if (cached) return cached.result
  }

  const selects = []
  const bindings = []
  for (let i = 0; i < question.periods; i++) {
    selects.push(`count(*) filter (where exists (${returnSql(question.returning, i, question.period, groupId)}))::int as r${i}`)
    if (groupId) bindings.push(groupId)
  }
  const milestoneGroup = question.start === 'group_joined' && groupId ? groupId : 0
  const memberFilter = groupId && question.start !== 'group_joined'
    ? 'and exists (select 1 from group_memberships gm where gm.user_id = m.user_id and gm.group_id = ? and gm.active)'
    : ''
  const sql = `
    select date_trunc('${question.period}', m.occurred_on::timestamp) as cohort_start,
      count(*)::int as size,
      ${selects.join(',\n')}
    from user_milestones m
    where m.milestone = ? and m.group_id = ? and m.occurred_on >= ?::date and m.occurred_on < ?::date
      ${memberFilter}
    group by 1
    order by 1
  `
  const params = [...bindings, question.start, milestoneGroup, utcDay(from), utcDay(cursor)]
  if (memberFilter) params.push(groupId)

  const rows = await knex.transaction(async trx => {
    await trx.raw('set local transaction read only')
    await trx.raw("set local statement_timeout = '10s'")
    const result = await trx.raw(sql, params)
    return result.rows || []
  })
  const cohorts = rows.map(row => ({
    cohortStart: row.cohort_start instanceof Date ? utcDay(row.cohort_start) : String(row.cohort_start).slice(0, 10),
    size: Number(row.size) || 0,
    returns: Array.from({ length: question.periods }, (_, index) => Number(row[`r${index}`]) || 0)
  }))
  const result = { cohorts }
  if (closed) {
    await knex('retention_cache').insert({ cache_key: cacheKey, result, computed_at: new Date() }).onConflict('cache_key').merge()
  }
  return result
}

/** Exposed for tests that only need the date walk to be valid. */
export function retentionWindow (question, now = new Date()) {
  parseDay(utcDay(now))
  return validateRetention(question)
}
