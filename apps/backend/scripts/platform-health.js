#!/usr/bin/env node

/**
 * Compute platform-health metrics directly against the database in DATABASE_URL,
 * without starting the server. Queries run in read-only transactions.
 *
 *   node scripts/platform-health.js --asOf=2026-03-27 --summary
 *   node scripts/platform-health.js --section=being_answered --out=/tmp/health.json
 *   node scripts/platform-health.js --metric=live_groups,weekly_connected_members
 */

require('@babel/register')
const argv = require('minimist')(process.argv.slice(2))
const knexConfig = require('../knexfile')
const { runPlatformHealth } = require('../lib/platformHealth/runner')

const list = value => value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : null

const formatHeadline = headline => {
  if (!headline || headline.value === null || headline.value === undefined) return ''
  const v = Number(headline.value)
  return Number.isInteger(v) ? String(v) : v.toFixed(4)
}

async function main () {
  const concurrency = argv.concurrency === undefined ? undefined : Number(argv.concurrency)
  if (concurrency !== undefined && !(Number.isInteger(concurrency) && concurrency > 0)) {
    throw new Error('--concurrency must be a positive integer')
  }
  const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development'])
  try {
    const result = await runPlatformHealth({
      knex,
      asOf: argv.asOf,
      sectionIds: list(argv.section),
      metricIds: list(argv.metric),
      concurrency
    })

    if (argv.out) {
      require('fs').writeFileSync(argv.out, JSON.stringify(result, null, 2))
    }

    if (argv.summary || argv.out) {
      console.log(`asOf ${result.asOf} · ${result.durationMs}ms`)
      for (const section of result.sections) {
        console.log(`\n[${section.id}] ${section.title}`)
        for (const m of section.metrics) {
          const status = m.error ? `ERROR ${m.error}` : 'ok'
          console.log(`  ${m.id.padEnd(40)} ${String(m.runtimeMs).padStart(6)}ms  ${formatHeadline(m.headline).padStart(10)}  ${status}`)
        }
      }
    } else {
      console.log(JSON.stringify(result, null, 2))
    }

    const failed = result.sections.flatMap(s => s.metrics).filter(m => m.error)
    process.exitCode = failed.length ? 1 : 0
  } finally {
    await knex.destroy()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
