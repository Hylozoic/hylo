/**
 * Copies Hylo's existing posts, comments, reactions, RSVPs, votes, joins and
 * signups into activity_events. Safe to run more than once.
 *
 *   node -r @babel/register scripts/analytics/backfill-events.js --from=2014-01-01 --to=2026-10-31
 */
require('@babel/register')
const argv = require('minimist')(process.argv.slice(2))
const knexConfig = require('../../knexfile')
const { backfillEvents } = require('../../lib/analytics/backfillEvents')
const { backfillDailyCounts } = require('../../lib/analytics/dailyCounts')

async function main () {
  const from = argv.from || '2014-01-01'
  const to = argv.to || new Date().toISOString().slice(0, 10)
  const knex = require('knex')(knexConfig[process.env.NODE_ENV || 'development'])
  try {
    const chunks = await backfillEvents(knex, { from, to, log: message => console.log(message) })
    console.log(`backfilled ${chunks} chunks from ${from} to ${to}`)
    console.log('computing daily counts')
    await backfillDailyCounts(knex, { from, to, log: message => console.log(message) })
  } finally {
    await knex.destroy()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
