/**
 * Rebuilds derived analytics for a date range. Safe to run again.
 *
 *   node -r @babel/register scripts/analytics/rebuild.js --from=2014-01-01 --to=2026-11-01
 *   node -r @babel/register scripts/analytics/rebuild.js --from=2026-01-01 --to=2026-11-01 --metric=live_groups
 */
require('@babel/register')
const argv = require('minimist')(process.argv.slice(2))
const knexConfig = require('../../knexfile')
const { rebuildAnalytics } = require('../../lib/analytics/rebuild')

async function main () {
  const from = argv.from || '2014-01-01'
  const to = argv.to || new Date().toISOString().slice(0, 10)
  const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development'])
  try {
    console.log(`rebuilding analytics from ${from} to ${to}`)
    await rebuildAnalytics(knex, { from, to, metric: argv.metric || null, log: message => console.log(message) })
    console.log('done')
  } finally {
    await knex.destroy()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
