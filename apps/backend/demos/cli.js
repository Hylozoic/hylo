/**
 * Build, check, and delete demo groups.
 *
 *   yarn demo validate demos/specs/river-city.json
 *   yarn demo resolve-images demos/specs/river-city.json
 *   yarn demo build demos/specs/river-city.json
 *   yarn demo build demos/specs/river-city.json --allow-prod --invite partner@example.com
 *   yarn demo delete river-city --allow-prod
 */
const fs = require('fs')
const path = require('path')

const backendRoot = path.join(__dirname, '..')
process.chdir(backendRoot)
require('dotenv').config({ path: path.join(backendRoot, '.env') })

const { validateDemoSpec } = require('../lib/demo/validate')
const { buildDemo, appBase } = require('../lib/demo/build')
const { teardownDemo, ensureTeardownIndexes } = require('../lib/demo/teardown')
const { resolveImages } = require('../lib/demo/resolveImages')

/**
 * CLI entry.
 */
async function main () {
  const args = process.argv.slice(2)
  const command = args[0]
  const allowProd = args.indexOf('--allow-prod') !== -1
  const positional = args.filter(arg => arg !== command && !arg.startsWith('--') && !looksLikeInviteValue(args, arg))
  const invites = inviteEmails(args)

  if (command === 'validate') return printValidation(loadSpec(positional[0]))
  if (command === 'resolve-images') {
    const file = specPath(positional[0])
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
    await resolveImages(file, spec)
    return printValidation(spec)
  }
  if (command === 'build') return build(positional[0], { allowProd, invites })
  if (command === 'delete') return remove(positional[0], { allowProd })
  console.error('Usage: yarn demo <validate|resolve-images|build|delete> <spec-or-slug> [--allow-prod] [--invite email]')
  process.exit(1)
}

/**
 * Validate and print errors.
 * @param {object} spec
 */
function printValidation (spec) {
  const errors = validateDemoSpec(spec)
  if (!errors.length) {
    console.info(`${spec.name}: spec is valid (${spec.people.length} people, ${spec.posts.length} posts)`)
    return
  }
  errors.forEach(error => console.error(`  ${error}`))
  console.error(`${errors.length} problem${errors.length === 1 ? '' : 's'}`)
  process.exit(1)
}

/**
 * Load a spec and rebuild it.
 * @param {string} target
 * @param {{ allowProd: boolean, invites: string[] }} options
 */
async function build (target, { allowProd, invites }) {
  const spec = loadSpec(target)
  const errors = validateDemoSpec(spec)
  if (errors.length) {
    errors.slice(0, 20).forEach(error => console.error(`  ${error}`))
    console.error('Spec is not valid. Fix it, or run resolve-images, before building.')
    process.exit(1)
  }
  assertWritable(allowProd)
  printTarget(spec)
  const knex = connect()
  try {
    const summary = await buildDemo(knex, spec)
    const base = appBase()
    console.info('')
    console.info(`${spec.name} is ready: ${base}/groups/${summary.slug}`)
    console.info(`Invite link: ${base}${summary.invitePath}`)
    if (invites.length) console.info(`Send that link to: ${invites.join(', ')}`)
    console.info(`Log in as ${spec.realUserEmail}. Generated neighbors use @demo.invalid and cannot sign in.`)
    console.info(`${summary.members} members, ${summary.posts} posts.`)
    if (summary.invited) console.info(`${summary.invited} invited membership${summary.invited === 1 ? '' : 's'} kept.`)
  } finally {
    await knex.destroy()
  }
}

/**
 * Delete a demo described by a spec.
 * @param {string} target
 * @param {{ allowProd: boolean }} options
 */
async function remove (target, { allowProd }) {
  const spec = loadSpec(target)
  assertWritable(allowProd)
  printTarget(spec)
  const knex = connect()
  try {
    const { refreshSearch, relationKind } = require('../lib/demo/build')
    await ensureTeardownIndexes(knex)
    const searchKind = await relationKind(knex, 'search_index')
    await knex.transaction(async trx => {
      await teardownDemo(trx, spec, searchKind)
    })
    await refreshSearch(knex, searchKind)
    console.info(`Deleted ${spec.name}.`)
  } finally {
    await knex.destroy()
  }
}

/**
 * Refuse a production write unless the operator passed the flag.
 * @param {boolean} allowProd
 */
function assertWritable (allowProd) {
  if (process.env.NODE_ENV === 'production' && !allowProd) {
    console.error('Refusing to write because NODE_ENV=production. Re-run with --allow-prod after you have checked the database host below.')
    printTarget()
    process.exit(1)
  }
}

/**
 * Print where this command will write, without credentials.
 * @param {object} [spec]
 */
function printTarget (spec) {
  let host = 'unknown'
  let database = 'unknown'
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL)
    host = url.hostname
    database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  }
  const env = process.env.NODE_ENV || 'development'
  console.info(`Target database: ${host} / ${database} (NODE_ENV=${env})`)
  if (spec) console.info(`Demo: ${spec.name} — ${spec.people.length} people, ${spec.posts.length} posts, ${(spec.spaces || []).length} spaces`)
}

/**
 * @param {string} target
 * @returns {object}
 */
function loadSpec (target) {
  return JSON.parse(fs.readFileSync(specPath(target), 'utf8'))
}

/**
 * A slug, or a path to a JSON file.
 * @param {string} target
 * @returns {string}
 */
function specPath (target) {
  if (!target) {
    console.error('Give a spec path or a demo slug.')
    process.exit(1)
  }
  if (target.endsWith('.json')) return path.resolve(target)
  return path.join(backendRoot, 'demos', 'specs', `${target}.json`)
}

/**
 * @returns {import('knex').Knex}
 */
function connect () {
  const knex = require('knex')
  const config = require(path.join(backendRoot, 'knexfile.js'))
  const env = process.env.NODE_ENV === 'production' ? 'production' : (process.env.NODE_ENV === 'staging' ? 'staging' : 'development')
  return knex(config[env] || config.development)
}

/**
 * Emails passed as repeated --invite flags.
 * @param {string[]} args
 * @returns {string[]}
 */
function inviteEmails (args) {
  const emails = []
  args.forEach((arg, index) => {
    if (arg === '--invite' && args[index + 1]) emails.push(args[index + 1])
  })
  return emails
}

/**
 * True when this arg is the value of a preceding --invite.
 * @param {string[]} args
 * @param {string} arg
 * @returns {boolean}
 */
function looksLikeInviteValue (args, arg) {
  const index = args.indexOf(arg)
  return index > 0 && args[index - 1] === '--invite'
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
