/**
 * Build the River City Mutual Aid demo in the local database.
 *
 *   cd apps/backend && node seeds/sacramento-demo/run.js
 *
 * Re-runnable. Deletes the previous River City group, its spaces, and the
 * demo @example.com users, then rebuilds with dates relative to today.
 * Requires tibet@terran.io. Photo APIs are optional if image-cache.json exists:
 * UNSPLASH_ACCESS_KEY and PEXELS_API_KEY in apps/backend/.env.
 */
const path = require('path')

const backendRoot = path.join(__dirname, '../..')
process.chdir(backendRoot)
require('dotenv').config({ path: path.join(backendRoot, '.env') })

const knex = require('knex')(require(path.join(backendRoot, 'knexfile.js')).development)
const { seedSacramentoDemo } = require('./seed')

seedSacramentoDemo(knex)
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => knex.destroy())
