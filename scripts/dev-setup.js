#!/usr/bin/env node

/**
 * Idempotent local setup for Hylo. Safe to re-run on the host or in the
 * dev container (HYLO_IN_DOCKER=1).
 *
 *   node scripts/dev-setup.js
 *   node scripts/dev-setup.js --reset-db
 *   node scripts/dev-setup.js --mobile
 *
 * Existing env files are left alone. The database is seeded only when the
 * users table is missing, or when --reset-db dropped it.
 * HYLO_SEED=large loads the full dummy dataset; the default is a small one.
 */

const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const inDocker = process.env.HYLO_IN_DOCKER === '1'
const resetDb = process.argv.includes('--reset-db')
const withMobile = process.argv.includes('--mobile')

const POSTGRES_URL = 'postgres://postgres:postgres@localhost:5432/postgres'
const DEV_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/hylo'
const TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/hylo_test'
const DATABASES = ['hylo', 'hylo_test']

const FOCUSED_WORKSPACES = [
  'backend',
  'web',
  '@hylo/shared',
  '@hylo/presenters',
  '@hylo/navigation',
  '@hylo/urql',
  '@hylo/hooks',
  '@hylo/graphql',
  '@hylo/contexts'
]

/**
 * Run a command and stream its output. Throws when the command fails.
 */
function run (command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    ...options
  })
}

/**
 * True when a relative path exists from the repo root.
 */
function exists (relative) {
  return fs.existsSync(path.join(root, relative))
}

/**
 * Install dependencies. In Docker, skip Expo and Electron unless a focused
 * install cannot build the shared packages.
 */
function installDependencies () {
  if (!inDocker) {
    console.log('Installing dependencies')
    run('yarn', ['install'])
    return
  }

  console.log('Installing backend, web, and shared package dependencies')
  try {
    run('yarn', ['workspaces', 'focus', ...FOCUSED_WORKSPACES])
  } catch (err) {
    console.log('yarn workspaces focus failed, falling back to a full yarn install')
    run('yarn', ['install'])
    return
  }

  const hasTsc = exists('packages/shared/node_modules/.bin/tsc') || exists('node_modules/.bin/tsc')
  const hasBabel = exists('packages/navigation/node_modules/.bin/babel') ||
    exists('packages/presenters/node_modules/.bin/babel') ||
    exists('node_modules/.bin/babel')
  if (!hasTsc || !hasBabel) {
    console.log('Focused install is missing package build tools, falling back to a full yarn install')
    run('yarn', ['install'])
  }
}

/**
 * Compile the shared packages the apps import.
 */
function buildPackages () {
  console.log('Building shared packages')
  run('yarn', ['build-packages'])
}

/**
 * Base64 PKCS#1 PEM, the same shape as `openssl genrsa 2048 | base64`.
 */
function generateOidcKey () {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' }
  })
  return Buffer.from(privateKey).toString('base64')
}

/**
 * Replace key=... in env file contents, or append the key when it is absent.
 */
function setEnvValue (contents, key, value) {
  const pattern = new RegExp('^' + key + '=.*$', 'm')
  const line = key + '=' + value
  if (pattern.test(contents)) return contents.replace(pattern, line)
  return contents.replace(/\s*$/, '\n') + line + '\n'
}

/**
 * Copy an example env file when the destination is missing.
 * transform receives the example contents and returns what to write.
 */
function ensureFile (examplePath, destPath, transform) {
  const relative = path.relative(root, destPath)
  if (fs.existsSync(destPath)) {
    console.log('Keeping existing ' + relative)
    return
  }
  let contents = fs.readFileSync(examplePath, 'utf8')
  if (transform) contents = transform(contents)
  fs.writeFileSync(destPath, contents)
  console.log('Created ' + relative)
}

/**
 * .env.test contents. Values match the backend README, aimed at hylo_test.
 * OIDC_KEYS is required because passport reads it while booting.
 */
function testEnvContents (oidcKey) {
  return [
    'DATABASE_URL=' + TEST_DATABASE_URL,
    'DOMAIN=testdomain',
    'KUE_NAMESPACE=qtest',
    'PROTOCOL=http',
    'SENTRY_DSN=',
    'SENDWITHUS_KEY=test_...',
    'INBOUND_EMAIL_SALT=FFFFAAAA123456789',
    'INBOUND_EMAIL_DOMAIN=inbound-staging.hylo.com',
    'PLAY_APP_SECRET=quxgrault12345678',
    'AWS_ACCESS_KEY_ID=foo',
    'UPLOADER_PATH_PREFIX=foo',
    'OIDC_KEYS=' + oidcKey,
    ''
  ].join('\n')
}

/**
 * Create missing env files. Never overwrite one a developer already edited.
 */
function ensureEnvFiles () {
  const oidcKey = generateOidcKey()
  const backendExample = path.join(root, 'apps/backend/.env.example')

  ensureFile(backendExample, path.join(root, 'apps/backend/.env'), contents => {
    let next = setEnvValue(contents, 'DATABASE_URL', DEV_DATABASE_URL)
    next = setEnvValue(next, 'REDIS_URL', 'redis://localhost:6379')
    return setEnvValue(next, 'OIDC_KEYS', oidcKey)
  })

  ensureFile(backendExample, path.join(root, 'apps/backend/.env.test'), () => testEnvContents(oidcKey))
  ensureFile(path.join(root, 'apps/web/.env.example'), path.join(root, 'apps/web/.env'))

  if (withMobile) {
    ensureFile(
      path.join(root, 'apps/mobile-leap/.env.example'),
      path.join(root, 'apps/mobile-leap/.env')
    )
  }
}

/**
 * Load pg from the backend workspace. It is not a dependency of the repo root.
 */
function loadPg () {
  const candidates = [
    path.join(root, 'apps/backend/node_modules/pg'),
    path.join(root, 'node_modules/pg')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return require(candidate)
  }
  throw new Error('Could not find the pg package. yarn install did not put it in apps/backend/node_modules.')
}

/**
 * Open a Postgres connection. The message names `yarn docker:services` when the server is down.
 */
async function connect (connectionString) {
  const { Client } = loadPg()
  const client = new Client({ connectionString })
  try {
    await client.connect()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      'Could not connect to Postgres (' + message + '). ' +
      'Start it with `yarn docker:services` or `docker compose up`, then run this again.'
    )
  }
  return client
}

/**
 * True when Postgres already has this database.
 */
async function databaseExists (client, name) {
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
  return result.rowCount > 0
}

/**
 * Kick other sessions off a database so DROP DATABASE can succeed.
 */
async function terminateConnections (client, name) {
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [name]
  )
}

/**
 * Drop a database, retrying once after disconnecting the app.
 */
async function dropDatabase (client, name) {
  console.log('Dropping database ' + name)
  await terminateConnections(client, name)
  try {
    await client.query('DROP DATABASE ' + name)
  } catch (err) {
    console.log('Drop failed (' + err.message + '), disconnecting sessions and retrying')
    await terminateConnections(client, name)
    await client.query('DROP DATABASE ' + name)
  }
}

/**
 * Create hylo and hylo_test. With --reset-db, drop them first.
 */
async function ensureDatabases () {
  const client = await connect(POSTGRES_URL)
  try {
    for (const name of DATABASES) {
      const exists = await databaseExists(client, name)
      if (resetDb && exists) await dropDatabase(client, name)
      if (resetDb || !exists) {
        console.log('Creating database ' + name)
        await client.query('CREATE DATABASE ' + name)
      }
    }
  } finally {
    await client.end()
  }
}

/**
 * True when the dev database already has the users table.
 */
async function usersTableExists () {
  const client = await connect(DEV_DATABASE_URL)
  try {
    const result = await client.query("SELECT to_regclass('public.users') AS name")
    return Boolean(result.rows[0] && result.rows[0].name)
  } finally {
    await client.end()
  }
}

/**
 * True when the dummy seed finished. It creates test@hylo.com last.
 * A failed earlier seed can leave some other user behind.
 */
async function devDataExists () {
  if (!(await usersTableExists())) return false
  const client = await connect(DEV_DATABASE_URL)
  try {
    const result = await client.query("SELECT 1 FROM users WHERE email = 'test@hylo.com' LIMIT 1")
    return result.rowCount > 0
  } finally {
    await client.end()
  }
}

/**
 * True when knex_migrations lists the baseline migrations.
 * schema.sql already created those tables, so migrate must not run them again.
 */
async function migrationsStamped () {
  if (!(await usersTableExists())) return false
  const client = await connect(DEV_DATABASE_URL)
  try {
    const table = await client.query("SELECT to_regclass('public.knex_migrations') AS name")
    if (!table.rows[0] || !table.rows[0].name) return false
    const result = await client.query('SELECT 1 FROM knex_migrations LIMIT 1')
    return result.rowCount > 0
  } finally {
    await client.end()
  }
}

/**
 * schema.sql with psql meta-commands (\\restrict, \\unrestrict) removed.
 */
function schemaSql () {
  return fs.readFileSync(path.join(root, 'apps/backend/migrations/schema.sql'), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !line.startsWith('\\'))
    .join('\n')
}

/**
 * Split a dump into statements. Semicolons inside quotes, comments, and
 * dollar-quoted function bodies stay put. pg runs one statement per query.
 */
function splitSql (sql) {
  const statements = []
  let current = ''
  let i = 0
  let dollarTag = null

  while (i < sql.length) {
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      current += sql[i]
      i++
      continue
    }

    const ch = sql[i]

    if (ch === "'") {
      current += ch
      i++
      while (i < sql.length) {
        current += sql[i]
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    if (ch === '"') {
      current += ch
      i++
      while (i < sql.length) {
        current += sql[i]
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 1)
      current += chunk
      i += chunk.length
      continue
    }

    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 2)
      current += chunk
      i += chunk.length
      continue
    }

    if (ch === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (ch === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

/**
 * False for statements that are only comments. Postgres rejects those as empty.
 */
function isExecutable (statement) {
  const without = statement
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim()
  return without.length > 0
}

/**
 * Run schema statements in one transaction, so a failure leaves the database empty.
 */
async function applySchema (statements) {
  const client = await connect(DEV_DATABASE_URL)
  try {
    await client.query('BEGIN')
    try {
      for (const statement of statements) {
        await client.query(statement)
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    }
  } finally {
    await client.end()
  }
}

/**
 * Load migrations/schema.sql into the hylo database.
 * The postgis image does not always ship pg_stat_statements, which the dump creates.
 */
async function loadSchema () {
  const statements = splitSql(schemaSql()).filter(isExecutable)
  console.log('Loading schema (' + statements.length + ' statements)')
  try {
    await applySchema(statements)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/pg_stat_statements/i.test(message)) throw err
    console.log('pg_stat_statements is not available, loading the schema without it')
    const withoutStats = statements.filter(statement => !/pg_stat_statements/i.test(statement))
    await applySchema(withoutStats)
  }
}

/**
 * Run the default seeds (including knex_migrations), then the dummy seed.
 * HYLO_SEED=large keeps the full dummy dataset. Anything else is the small one.
 */
function seedDatabase () {
  const backend = path.join(root, 'apps/backend')
  const seedSize = process.env.HYLO_SEED === 'large' ? 'large' : 'small'
  console.log('Seeding base data')
  run('yarn', ['knex', 'seed:run'], {
    cwd: backend,
    env: { ...process.env, NODE_ENV: 'development' }
  })
  console.log('Seeding dummy data (' + seedSize + ')')
  run('yarn', ['knex', 'seed:run'], {
    cwd: backend,
    env: {
      ...process.env,
      NODE_ENV: 'dummy',
      HYLO_SEED: seedSize,
      HYLO_SEED_CONFIRM: 'yes'
    }
  })
}

/**
 * Apply migrations added after migrations/schema.sql was dumped.
 */
function migrate () {
  console.log('Applying migrations')
  run('yarn', ['migrate'])
}

/**
 * Print the login and where to open the app.
 */
function printReady () {
  console.log('')
  console.log('Hylo dev data is ready.')
  console.log('  Login:    test@hylo.com')
  console.log('  Password: hylo')
  console.log('')
  if (inDocker) {
    console.log('The API and web containers start next.')
    console.log('Open http://localhost:3000')
  } else {
    console.log('Start the app with `yarn backend:dev` and `yarn web:dev`.')
    console.log('Open http://localhost:3000')
  }
  console.log('')
  console.log('Optional keys, if you need the feature: Mapbox (maps), Filestack (uploads),')
  console.log('SendWithUs (email), Stripe (payments), Virtuoso VITE_VIRTUOSO_KEY (chat watermark).')
}

/**
 * Install, write env files, create databases, and seed when the dev DB is empty.
 */
async function main () {
  installDependencies()
  buildPackages()
  ensureEnvFiles()
  await ensureDatabases()
  const hasSchema = await usersTableExists()
  const hasData = hasSchema && await devDataExists()
  const stamped = hasSchema && await migrationsStamped()
  if (resetDb || !hasSchema) {
    await loadSchema()
  }
  if (resetDb || !hasData || !stamped) {
    if (hasSchema && !stamped) {
      console.log('Migration history is missing, so the seed will run again')
    }
    seedDatabase()
  } else {
    console.log('Database already has data, skipping schema and seed')
  }
  migrate()
  printReady()
}

if (require.main === module) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}

module.exports = { splitSql, isExecutable, setEnvValue }
