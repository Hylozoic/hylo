const path = require('path')
const fs = require('fs')

const environment = process.env.NODE_ENV || 'development'
const config = require('../../knexfile')[environment]
const knex = require('knex')(config)

const MIGRATIONS_DIR = path.resolve(__dirname, '..')

/**
 * Resolve a migration filename to a file inside migrations/.
 * Accepts `2026….js` or the same name without `.js`.
 */
function resolveMigrationFile (rawName) {
  if (!rawName || typeof rawName !== 'string') return null
  const base = path.basename(rawName.trim())
  const name = base.endsWith('.js') ? base : `${base}.js`
  const filePath = path.join(MIGRATIONS_DIR, name)
  if (!filePath.startsWith(MIGRATIONS_DIR + path.sep)) return null
  if (!fs.existsSync(filePath)) return null
  return { name, filePath }
}

/**
 * Rolls back one recorded knex migration by filename, then removes its
 * knex_migrations row so `yarn migrate` will re-run that file's `up`.
 * Later migrations stay in place. Dev/staging only.
 *
 * Usage: yarn rollback:specific 20260703000000_migrate_context_widgets_to_group_views.js
 */
async function run () {
  const resolved = resolveMigrationFile(process.argv[2])
  if (!resolved) {
    console.error('[rollback:specific] pass a migration filename from migrations/, e.g.')
    console.error('  yarn rollback:specific 20260703000000_migrate_context_widgets_to_group_views.js')
    process.exitCode = 1
    return
  }

  const { name, filePath } = resolved
  const migration = require(filePath)
  if (typeof migration.down !== 'function') {
    console.error(`[rollback:specific] ${name} has no down() export.`)
    process.exitCode = 1
    return
  }

  const row = await knex('knex_migrations').where({ name }).first()
  if (!row) {
    console.log(`[rollback:specific] ${name} is not recorded as run; nothing to roll back.`)
    return
  }

  console.log(`[rollback:specific] rolling back ${name}…`)
  await migration.down(knex)
  await knex('knex_migrations').where({ name }).delete()
  console.log(`[rollback:specific] done. Re-run with \`yarn migrate\` to apply ${name} again.`)
}

run()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => knex.destroy())
