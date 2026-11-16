/**
 * Computes day, week, month and year snapshots from activity_days and
 * activity_events. Run it after backfill-events. Safe to run again.
 *
 *   node -r @babel/register scripts/analytics/backfill-snapshots.js --from=2014-01-01 --to=2026-10-31
 */
require('@babel/register')
const argv = require('minimist')(process.argv.slice(2))
const knexConfig = require('../../knexfile')
const { backfillSnapshots } = require('../../lib/analytics/snapshots')

async function main () {
  const from = argv.from || '2014-01-01'
  const to = argv.to || new Date().toISOString().slice(0, 10)
  const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development'])
  try {
    console.log(`computing snapshots from ${from} to ${to}`)
    await backfillSnapshots(knex, { from, to })
    console.log('done')
  } finally {
    await knex.destroy()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
