import { computeDailyCounts } from './dailyCounts'
import { backfillSnapshots } from './snapshots'
import { computeMonth, computeWeek } from './metrics/health'
import { addPeriod, parseDay, startOfWeek, utcDay, windows } from './periods'
import { fillEventLinks, refreshGroupWeek, refreshMilestones, refreshPostOutcomes, refreshUserDays } from './rollups'

/**
 * Rebuilds derived analytics for a date range. Safe to run again: each step
 * deletes and rewrites its own rows. Pass `metric` to limit which periods run.
 */
export async function rebuildAnalytics (knex, { from, to, metric = null, log = () => {} } = {}) {
  const now = new Date()
  log('linking posts')
  await fillEventLinks(knex)

  if (!metric) {
    log('daily counts')
    for (const chunk of windows(from, to, 31)) {
      await computeDailyCounts(knex, chunk.from.slice(0, 10), chunk.to.slice(0, 10))
    }
    log('person tables')
    await refreshUserDays(knex, from, to)
    await refreshMilestones(knex, { replace: true })
    const chunks = windows(from, to, 31)
    log(`post outcomes, ${chunks.length} chunks`)
    for (const chunk of chunks) {
      const day = chunk.from.slice(0, 10)
      log(`post outcomes ${day}`)
      const written = await refreshPostOutcomes(knex, chunk.from, chunk.to)
      log(`post outcomes ${day} wrote ${written}`)
    }
    log('snapshots')
    await backfillSnapshots(knex, { from, to })
  }

  const weekMetric = !metric || ['contributors_posting', 'connected_beyond_reaction', 'coordinating_members', 'live_groups', 'live_group_survival', 'connection_concentration', 'live_groups_linked', 'place_coverage_live_groups', 'average_dau', 'weekly_missed_connections', 'where_connections_are_missed', 'feed_post_response_rate_7d', 'first_post_answered_7d', 'reciprocal_tie_members', 'join_request_decision_time'].includes(metric)
  const monthMetric = !metric || !weekMetric

  if (weekMetric) {
    let monday = startOfWeek(parseDay(from))
    const end = parseDay(to)
    while (monday < end) {
      const weekEnd = addPeriod(monday, 'week')
      if (weekEnd <= end) {
        const weekStart = utcDay(monday)
        log(weekStart)
        await refreshGroupWeek(knex, weekStart)
        await computeWeek(knex, weekStart, now)
      }
      monday = addPeriod(monday, 'week')
    }
  }

  if (monthMetric) {
    let month = new Date(Date.UTC(parseDay(from).getUTCFullYear(), parseDay(from).getUTCMonth(), 1))
    const end = parseDay(to)
    while (month < end) {
      const monthEnd = addPeriod(month, 'month')
      if (monthEnd <= end) {
        log(utcDay(month))
        await computeMonth(knex, utcDay(month), now)
      }
      month = monthEnd
    }
  }
}
