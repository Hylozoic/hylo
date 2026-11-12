import { GraphQLError } from 'graphql'
import { audienceActivity } from './audienceActivity'
import { fillPoints, parseDay } from './periods'
import { METRICS, metricIds, sourceMetric, storedIdsFor } from './metrics/registry'

const AUDIENCE = new Set(['active_users', 'wau', 'mau'])

export const MIN_COHORT = 5
const PERIODS = ['day', 'week', 'month', 'year']
const MAX_POINTS = { day: 400, week: 260, month: 240, year: 20 }

/** Below this many people, a group's retention numbers are hidden. */
export function hideSmallCohorts (series, groupId) {
  if (String(groupId) === '0') return series
  const cohort = series.find(item => item.metric === 'contributor_cohort')
  const retained = series.find(item => item.metric === 'contributor_retained')
  if (!cohort) return series
  cohort.points.forEach((point, index) => {
    if (point.value !== null && point.value > 0 && point.value < MIN_COHORT) {
      point.value = null
      if (retained && retained.points[index]) retained.points[index].value = null
    }
  })
  return series
}

function assertRange (period, from, to) {
  if (!PERIODS.includes(period)) throw new GraphQLError('period must be day, week, month or year')
  const start = parseDay(from)
  const end = parseDay(to)
  if (end < start) throw new GraphQLError('from must be on or before to')
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  const points = period === 'day' ? days : period === 'week' ? days / 7 : period === 'month' ? days / 28 : days / 365
  if (points > MAX_POINTS[period]) throw new GraphQLError('date range is too long')
}

/**
 * Reads stored metric values for one group (or the platform when groupId is 0).
 * Periods that were never computed come back as null, not zero.
 */
/** Stickiness is daily active people divided by the 30-day active people. */
function stickinessPoints (active, monthly) {
  return active.map((point, index) => {
    const base = monthly[index]
    if (!point || point.value === null || !base || !base.value) return { periodStart: point.periodStart, value: null, dimension: '' }
    return { periodStart: point.periodStart, value: point.value / base.value, dimension: '' }
  })
}

/**
 * Reads stored metric values for one group (or the platform when groupId is 0).
 * Periods that were never computed come back as null, not zero. A metric can
 * have several series, one per dimension. The empty dimension is the headline.
 */
export async function readSeries ({ knex, groupId, metrics, period, from, to }) {
  assertRange(period, from, to)
  const requested = metrics && metrics.length ? metrics : ['active_users']
  const unknown = requested.filter(metric => !metricIds().includes(metric))
  if (unknown.length) throw new GraphQLError(`unknown metric ${unknown[0]}`)

  const stored = storedIdsFor(requested)
  const rows = await knex('metric_snapshots')
    .where({ group_id: groupId, period })
    .whereIn('metric', stored)
    .where('period_start', '>=', from)
    .where('period_start', '<=', to)
    .select('metric', 'dimension', 'period_start', 'value')

  const audience = period === 'day' && stored.some(id => AUDIENCE.has(id))
    ? await audienceActivity({ knex, groupId, from, to })
    : null

  const byKey = new Map()
  for (const row of rows) {
    const dimension = row.dimension || ''
    const key = `${row.metric}\0${dimension}`
    if (!byKey.has(key)) byKey.set(key, [])
    const value = row.value === null ? null : Number(row.value)
    const periodStart = row.period_start instanceof Date ? row.period_start.toISOString().slice(0, 10) : String(row.period_start).slice(0, 10)
    byKey.get(key).push({ periodStart, value, dimension })
  }

  const filled = (metric, dimension = '') => {
    const live = audience && dimension === '' ? audience[metric] : null
    const points = live || byKey.get(`${metric}\0${dimension}`) || []
    return fillPoints(points, { from, to, period }).map(point => ({ ...point, dimension }))
  }

  const series = []
  for (const metric of requested) {
    const entry = METRICS[metric]
    if (entry.kind === 'derived' && metric === 'stickiness') {
      series.push({ metric, dimension: '', points: stickinessPoints(filled('active_users'), filled('mau')) })
      continue
    }
    if (entry.kind === 'display') {
      for (const need of entry.needs) series.push({ metric: need, dimension: '', points: filled(need) })
      continue
    }
    const source = sourceMetric(metric)
    const dimensions = [...byKey.keys()].filter(key => key.startsWith(`${source}\0`)).map(key => key.split('\0')[1])
    const shown = dimensions.length ? dimensions : ['']
    for (const dimension of shown) {
      series.push({ metric, dimension, points: filled(source, dimension) })
    }
  }
  return hideSmallCohorts(series, groupId)
}

/** Platform-wide metrics. Only Hylo admins can read them. */
export async function readPlatformMetrics (userId, { metrics, period, from, to }) {
  if (!(await Admin.isSuperAdmin(userId))) throw new GraphQLError('Unauthorized')
  return readSeries({ knex: bookshelf.knex, groupId: 0, metrics, period, from, to })
}

/** One group's metrics. Only a steward of that group can read them. */
export async function readGroupMetrics (group, { metrics, period, from, to }, context) {
  const groupId = group.id || group.get('id')
  const allowed = await GroupMembership.hasResponsibility(
    context.currentUserId, groupId, Responsibility.constants.RESP_ADMINISTRATION
  )
  if (!allowed) throw new GraphQLError("You don't have permission to view this group's metrics")
  return readSeries({ knex: bookshelf.knex, groupId, metrics, period, from, to })
}
