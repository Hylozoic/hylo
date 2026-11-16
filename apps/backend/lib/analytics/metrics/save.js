import { METRICS } from './registry'

/**
 * Replaces one metric's rows for a period. Running it twice leaves the same rows.
 */
export async function saveMetric (knex, metric, period, periodStart, rows) {
  const version = METRICS[metric] ? METRICS[metric].version : 1
  await knex('metric_snapshots').where({ metric, period, period_start: periodStart }).del()
  const now = new Date()
  const prepared = (rows || []).filter(row => row.value !== null && row.value !== undefined && !Number.isNaN(Number(row.value)))
  for (let i = 0; i < prepared.length; i += 500) {
    await knex('metric_snapshots').insert(prepared.slice(i, i + 500).map(row => ({
      group_id: row.group_id,
      metric,
      dimension: row.dimension || '',
      period,
      period_start: periodStart,
      value: row.value,
      definition_version: version,
      computed_at: now
    })))
  }
}

/** Runs a query and returns its rows. */
export async function queryRows (knex, sql, bindings) {
  const result = await knex.raw(sql, bindings)
  return result.rows || []
}
