import { normalizeAsOf, renderSql } from './sql'
import computeHeadline from './headline'
import { NORTH_STAR, ANTI_METRICS, INSTRUMENTATION_GAPS } from './definitions'
import SECTIONS from './sections'

export const STATEMENT_TIMEOUT_MS = 30000
export const DEFAULT_CONCURRENCY = 4

async function runQuery (knex, sql) {
  return knex.transaction(async trx => {
    await trx.raw('set transaction read only')
    await trx.raw(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const result = await trx.raw(sql)
    return result.rows
  })
}

// Knex prefixes database errors with the full query ("<sql> - <message>"); only
// the database's message is useful to a reader, and the SQL shouldn't reach browsers.
export function cleanErrorMessage (err) {
  const message = (err && err.message) || String(err)
  const i = message.lastIndexOf(' - ')
  return i >= 0 && /\bselect\b|\bwith\b/i.test(message.slice(0, i)) ? message.slice(i + 3) : message
}

async function runMetric (knex, metric, asOfIso) {
  const started = Date.now()
  try {
    const rows = await runQuery(knex, renderSql(metric.sql, asOfIso))
    const data = metric.transform(rows, { asOf: asOfIso })
    return { data, headline: computeHeadline(metric, data), error: null, runtimeMs: Date.now() - started }
  } catch (err) {
    return { data: null, headline: null, error: cleanErrorMessage(err), runtimeMs: Date.now() - started }
  }
}

async function mapWithConcurrency (items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

function publicFields (metric) {
  const { sql, transform, headline, ...rest } = metric
  return rest
}

/*
 * Computes every platform-health metric as of a moment in time.
 * Each metric runs in its own read-only transaction; one failing metric
 * reports its error without affecting the others.
 */
export async function runPlatformHealth ({ knex, asOf, sectionIds = null, metricIds = null, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const asOfIso = normalizeAsOf(asOf)
  const started = Date.now()

  const sections = SECTIONS
    .filter(s => !sectionIds || sectionIds.includes(s.section.id))
    .map(s => ({ ...s, metrics: s.metrics.filter(m => !metricIds || metricIds.includes(m.id)) }))

  const jobs = sections.flatMap(s => s.metrics.map(m => ({ sectionId: s.section.id, metric: m })))
  const limit = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY
  const outcomes = await mapWithConcurrency(jobs, limit, job => runMetric(knex, job.metric, asOfIso))

  const byId = new Map(jobs.map((job, i) => [job.metric.id, outcomes[i]]))

  return {
    asOf: asOfIso,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    northStar: NORTH_STAR,
    sections: sections.map(s => ({
      ...s.section,
      metrics: s.metrics.map(m => ({ ...publicFields(m), ...byId.get(m.id) }))
    })),
    antiMetrics: ANTI_METRICS,
    instrumentationGaps: INSTRUMENTATION_GAPS
  }
}
