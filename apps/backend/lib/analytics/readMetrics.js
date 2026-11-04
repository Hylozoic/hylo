import { GraphQLError } from 'graphql'
import { METRIC_IDS } from './snapshots'
import { fillPoints, parseDay } from './periods'

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
export async function readSeries ({ knex, groupId, metrics, period, from, to }) {
  assertRange(period, from, to)
  const requested = metrics && metrics.length ? metrics : ['active_users']
  const unknown = requested.filter(metric => !METRIC_IDS.includes(metric))
  if (unknown.length) throw new GraphQLError(`unknown metric ${unknown[0]}`)

  const rows = await knex('metric_snapshots')
    .where({ group_id: groupId, period })
    .whereIn('metric', requested)
    .where('dimension', '')
    .where('period_start', '>=', from)
    .where('period_start', '<=', to)
    .select('metric', 'period_start', 'value')

  const byMetric = new Map(requested.map(metric => [metric, []]))
  for (const row of rows) {
    const value = row.value === null ? null : Number(row.value)
    const periodStart = row.period_start instanceof Date ? row.period_start.toISOString().slice(0, 10) : String(row.period_start).slice(0, 10)
    byMetric.get(row.metric).push({ periodStart, value })
  }

  const series = requested.map(metric => ({
    metric,
    points: fillPoints(byMetric.get(metric), { from, to, period })
  }))
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
