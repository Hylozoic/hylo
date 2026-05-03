import { spawn, spawnSync } from 'child_process'
import dotenv from 'dotenv'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webRoot = path.resolve(__dirname, '..')
dotenv.config({ path: path.resolve(webRoot, '.env') })
const repoRoot = path.resolve(webRoot, '..', '..')
const backendRoot = path.resolve(repoRoot, 'apps', 'backend')
// OIDC_KEYS etc. for print-e2e-notification-jwt.js (dotenv does not override existing vars)
dotenv.config({ path: path.resolve(backendRoot, '.env') })
const schemaPath = path.resolve(backendRoot, 'migrations', 'schema.sql')

const DEFAULT_E2E_DB = 'hylo_e2e'
const DANGEROUS_DB_NAMES = new Set(['hylo', 'hylo_test', 'postgres', 'template0', 'template1'])

/**
 * One logical DB name for dropdb/createdb/psql/backend. URL path wins when E2E_DATABASE_URL is set.
 */
function resolveE2eDatabase () {
  const rawUrl = process.env.E2E_DATABASE_URL
  const envDbName = process.env.E2E_DB_NAME

  if (rawUrl) {
    const withScheme =
      rawUrl.startsWith('postgres://') || rawUrl.startsWith('postgresql://')
        ? rawUrl.trim()
        : `postgresql://${rawUrl.trim()}`
    const u = new URL(withScheme)
    const segment = (u.pathname || '/').replace(/^\//, '').split('/')[0] || ''
    let nameFromUrl = segment ? decodeURIComponent(segment) : ''
    if (!nameFromUrl) {
      nameFromUrl = envDbName || DEFAULT_E2E_DB
    }
    if (envDbName && envDbName !== nameFromUrl) {
      throw new Error(
        `[isolated-e2e] E2E_DB_NAME (${envDbName}) must match database in E2E_DATABASE_URL (${nameFromUrl})`
      )
    }
    u.pathname = `/${nameFromUrl}`
    return { e2eDbUrl: u.toString(), e2eDbName: nameFromUrl }
  }

  const e2eDbName = envDbName || DEFAULT_E2E_DB
  const e2eDbUrl = `postgresql://postgres@127.0.0.1:5432/${e2eDbName}`
  return { e2eDbUrl, e2eDbName }
}

const { e2eDbUrl, e2eDbName } = resolveE2eDatabase()

if (DANGEROUS_DB_NAMES.has(e2eDbName.toLowerCase()) && process.env.E2E_ALLOW_DANGEROUS_DB !== '1') {
  throw new Error(
    `[isolated-e2e] Refusing to use database "${e2eDbName}" for E2E (drop/create/seed). ` +
      `Point E2E_DATABASE_URL at a dedicated DB (e.g. .../${DEFAULT_E2E_DB}) or set E2E_ALLOW_DANGEROUS_DB=1.`
  )
}

/**
 * dropdb/createdb/psql use PG* env vars, not DATABASE_URL. Derive them so Docker TCP works.
 */
function pgCliEnvFromDatabaseUrl (databaseUrl) {
  const raw = databaseUrl.trim()
  const withScheme =
    raw.startsWith('postgres://') || raw.startsWith('postgresql://')
      ? raw
      : `postgresql://${raw}`
  const u = new URL(withScheme)
  const user = decodeURIComponent(u.username || 'postgres')
  const password = u.password != null && u.password !== ''
    ? decodeURIComponent(u.password)
    : undefined
  const host = u.hostname || '127.0.0.1'
  const port = u.port || '5432'
  const env = {
    PGHOST: host,
    PGPORT: port,
    PGUSER: user,
    // Docker Postgres typically has no TLS; 'prefer' makes libpq try SSL and can confuse tooling
    PGSSLMODE: process.env.PGSSLMODE || 'disable'
  }
  if (password !== undefined) {
    env.PGPASSWORD = password
  }
  return env
}

const pgCliEnv = pgCliEnvFromDatabaseUrl(e2eDbUrl)
/** Default off :3000 so a normal `yarn dev` can stay up while E2E runs */
const e2eWebPort = process.env.E2E_WEB_PORT || '3330'
const e2eSeedProfile = process.env.E2E_SEED_PROFILE || 'e2e'
const keepDb = process.env.E2E_KEEP_DB === '1'

/**
 * Returns true if something already accepts HTTP on this port (e.g. stale Sails on 3101).
 * A listen-only probe on 127.0.0.1 can miss listeners bound other ways (IPv6 / 0.0.0.0).
 */
async function portAcceptsHttp (port) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 800)
  try {
    const r = await fetch(`http://127.0.0.1:${port}/noo/graphql`, {
      method: 'GET',
      signal: ac.signal
    })
    return r.status >= 100 && r.status < 600
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/**
 * When E2E_BACKEND_PORT is unset, pick the first free port in a range so a leftover
 * Sails process on 3101 does not block the run (EADDRINUSE).
 */
function listenProbePort (port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    const onErr = (err) => {
      s.removeAllListeners()
      reject(err)
    }
    s.once('error', onErr)
    s.listen(Number(port), '127.0.0.1', () => {
      s.removeListener('error', onErr)
      s.close(() => resolve())
    })
  })
}

async function resolveBackendPort () {
  const pinned = process.env.E2E_BACKEND_PORT
  if (pinned) {
    const p = Number(pinned)
    if (await portAcceptsHttp(p)) {
      throw new Error(
        `[isolated-e2e] E2E_BACKEND_PORT=${pinned} already responds at /noo/graphql. ` +
          'Stop the other API or unset E2E_BACKEND_PORT to auto-pick a port.'
      )
    }
    return pinned
  }
  const lo = Number(process.env.E2E_BACKEND_PORT_RANGE_LO || '3101')
  const hi = Number(process.env.E2E_BACKEND_PORT_RANGE_HI || '3199')
  for (let p = lo; p <= hi; p++) {
    if (await portAcceptsHttp(p)) {
      console.warn(
        `[isolated-e2e] Port ${p} already responds at /noo/graphql; skipping (foreign or stale API)`
      )
      continue
    }
    try {
      await listenProbePort(p)
      console.log(`[isolated-e2e] Using free API port ${p} (set E2E_BACKEND_PORT to pin)`)
      return String(p)
    } catch {
      // EADDRINUSE or similar — try next
    }
  }
  throw new Error(
    `[isolated-e2e] No free TCP port for API between ${lo} and ${hi}. Free a port or set E2E_BACKEND_PORT.`
  )
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd || webRoot,
    env: options.env || process.env
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const runCapture = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    cwd: options.cwd || webRoot,
    env: options.env || process.env
  })

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.trim() : ''
    throw new Error(stderr || `${command} ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * URL to the `postgres` maintenance DB on the same server as `anyDbUrl` (for admin SQL).
 */
function postgresAdminUrl (anyDbUrl) {
  const raw = anyDbUrl.trim()
  const withScheme =
    raw.startsWith('postgres://') || raw.startsWith('postgresql://')
      ? raw
      : `postgresql://${raw}`
  const u = new URL(withScheme)
  u.pathname = '/postgres'
  return u.toString()
}

/**
 * Disconnect all backends using this database so DROP DATABASE / dropdb can succeed.
 * Needed when a prior Sails run, GUI client, or interrupted E2E left sessions open.
 */
function terminateSessionsToDatabase (dbName, anyDbUrl, pgEnv) {
  const adminUrl = postgresAdminUrl(anyDbUrl)
  const safe = dbName.replace(/'/g, "''")
  const sql = `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${safe}' AND pid <> pg_backend_pid();`
  const result = spawnSync('psql', [adminUrl, '-c', sql], {
    cwd: backendRoot,
    env: { ...process.env, ...pgEnv },
    encoding: 'utf8'
  })
  if (result.status !== 0 && result.stderr) {
    console.warn(`[isolated-e2e] pg_terminate_backend (non-fatal): ${result.stderr.trim()}`)
  }
}

/**
 * Polls until `url` returns a non-5xx status, or throws on timeout / optional abort (e.g. child exited).
 */
const waitForBackend = async (url, timeoutMs = 120000, shouldAbort = () => null) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const abortMsg = shouldAbort()
    if (abortMsg) {
      throw new Error(abortMsg)
    }
    try {
      const response = await fetch(url)
      if (response.status < 500) return
    } catch (e) {
      // keep waiting until timeout
    }
    await sleep(1000)
  }
  throw new Error(`Backend did not become ready: ${url}`)
}

const setupDatabase = (backendEnv) => {
  console.log(`\n[isolated-e2e] Recreating DB ${e2eDbName}`)
  terminateSessionsToDatabase(e2eDbName, e2eDbUrl, pgCliEnv)
  run('dropdb', ['--if-exists', e2eDbName], { cwd: backendRoot, env: backendEnv })
  run('createdb', [e2eDbName], { cwd: backendRoot, env: backendEnv })
  run('psql', [e2eDbUrl, '-f', schemaPath], { cwd: backendRoot, env: backendEnv })

  if (e2eSeedProfile === 'none') {
    console.log('[isolated-e2e] Skipping seed step (E2E_SEED_PROFILE=none)')
  } else if (e2eSeedProfile === 'e2e') {
    console.log('[isolated-e2e] Seeding E2E baseline (single pg connection)')
    run('node', ['scripts/seed-e2e-baseline.js'], { cwd: backendRoot, env: backendEnv })
  } else {
    console.log(`[isolated-e2e] Seeding DB with Knex profile: ${e2eSeedProfile}`)
    const seedEnv = {
      ...backendEnv,
      NODE_ENV: e2eSeedProfile
    }
    run('yarn', ['knex', 'seed:run'], { cwd: backendRoot, env: seedEnv })
  }
}

const runE2E = async () => {
  const e2eBackendPort = await resolveBackendPort()

  const backendEnv = {
    ...process.env,
    ...pgCliEnv,
    DATABASE_URL: e2eDbUrl,
    PORT: e2eBackendPort,
    NODE_ENV: 'development',
    PROTOCOL: 'http',
    DOMAIN: `localhost:${e2eWebPort}`,
    /** Lets decodeHyloJWT accept tokens minted when DOMAIN briefly differs (e.g. :3000 vs E2E web :3330) */
    HYLO_JWT_EXTRA_ISSUERS: ['http://localhost:3000', `http://localhost:${e2eWebPort}`].join(','),
    COOKIE_NAME: process.env.E2E_COOKIE_NAME || `hylo-e2e-${e2eBackendPort}`,
    /** Sails cluster in development can fork workers that fight for the same port (EADDRINUSE). */
    WEB_CONCURRENCY: '1',
    HEROKU_AVAILABLE_PARALLELISM: '1'
  }

  setupDatabase(backendEnv)

  let e2eNotificationJwt = ''
  if (e2eSeedProfile !== 'none') {
    try {
      e2eNotificationJwt = runCapture('node', ['scripts/print-e2e-notification-jwt.js'], {
        cwd: backendRoot,
        env: backendEnv
      }).trim()
    } catch (e) {
      console.warn(
        '[isolated-e2e] No notification JWT for E2E (set OIDC_KEYS in env like local backend).',
        e.message
      )
    }
  }

  const playwrightEnv = {
    ...process.env,
    /** Playwright must spawn its own Vite so `/noo` proxy target matches the isolated API port */
    E2E_ISOLATED: '1',
    E2E_WEB_PORT: e2eWebPort,
    E2E_BACKEND_PORT: e2eBackendPort,
    VITE_API_HOST: `http://localhost:${e2eBackendPort}`,
    PORT: e2eWebPort,
    /** Pipe `[Hylo GraphQL]` / `[Hylo checkLogin]` from the browser to the test runner terminal */
    E2E_FORWARD_BROWSER_LOGS: process.env.E2E_FORWARD_BROWSER_LOGS || '',
    ...(e2eNotificationJwt ? { E2E_NOTIFICATION_PAGE_JWT: e2eNotificationJwt } : {})
  }

  console.log(
    `[isolated-e2e] Starting backend on port ${e2eBackendPort} (DOMAIN=${backendEnv.DOMAIN}, PROTOCOL=${backendEnv.PROTOCOL})`
  )
  const backend = spawn('node', ['app.js'], {
    cwd: backendRoot,
    env: backendEnv,
    stdio: 'inherit'
  })

  let backendClosed = false
  /** @type {number | null | undefined} */
  let backendExitCode
  backend.on('exit', (code, signal) => {
    backendClosed = true
    backendExitCode = code
    if (code !== 0 && code != null) {
      console.error(`[isolated-e2e] Backend exited with code ${code}${signal ? ` (${signal})` : ''}`)
    }
  })

  let teardownDone = false

  const cleanupAsync = async () => {
    if (teardownDone) return
    teardownDone = true

    if (!backendClosed) {
      backend.kill('SIGTERM')
      for (let i = 0; i < 60; i++) {
        if (backendClosed) break
        await sleep(100)
      }
      if (!backendClosed) {
        console.warn('[isolated-e2e] Isolated API did not exit after SIGTERM; sending SIGKILL')
        backend.kill('SIGKILL')
        await sleep(400)
      }
    }

    if (!keepDb) {
      try {
        console.log(`[isolated-e2e] Dropping DB ${e2eDbName}`)
        terminateSessionsToDatabase(e2eDbName, e2eDbUrl, pgCliEnv)
        runCapture('dropdb', ['--if-exists', e2eDbName], { cwd: backendRoot, env: backendEnv })
      } catch (e) {
        console.warn(`[isolated-e2e] Failed to drop DB ${e2eDbName}: ${e.message}`)
        terminateSessionsToDatabase(e2eDbName, e2eDbUrl, pgCliEnv)
        try {
          runCapture('dropdb', ['--if-exists', e2eDbName], { cwd: backendRoot, env: backendEnv })
        } catch (e2) {
          console.warn(`[isolated-e2e] dropdb retry failed: ${e2.message}`)
        }
      }
    }
  }

  const exitAfterTeardown = async (code) => {
    await cleanupAsync()
    process.exit(code)
  }

  let signalTeardownStarted = false
  process.on('SIGINT', () => {
    if (signalTeardownStarted) return
    signalTeardownStarted = true
    exitAfterTeardown(130)
  })
  process.on('SIGTERM', () => {
    if (signalTeardownStarted) return
    signalTeardownStarted = true
    exitAfterTeardown(143)
  })

  try {
    await waitForBackend(
      `http://localhost:${e2eBackendPort}/noo/graphql`,
      120000,
      () => {
        if (!backendClosed) return null
        if (backendExitCode === 0) {
          return 'Backend exited before becoming ready (exit 0). Check logs above.'
        }
        if (backendExitCode != null) {
          return (
            `Backend failed to start (exit ${backendExitCode}). ` +
            'If you saw EADDRINUSE, free the API port or unset E2E_BACKEND_PORT to scan.'
          )
        }
        return 'Backend process ended before becoming ready.'
      }
    )

    console.log(
      `[isolated-e2e] Running Playwright (web http://localhost:${e2eWebPort}, API http://localhost:${e2eBackendPort})`
    )
    const cliArgs = process.argv.slice(2)
    run('yarn', ['node', 'node_modules/@playwright/test/cli.js', 'test', ...cliArgs], {
      cwd: webRoot,
      env: playwrightEnv
    })
  } finally {
    await cleanupAsync()
  }
}

runE2E().catch(error => {
  console.error(`[isolated-e2e] ${error.message}`)
  process.exit(1)
})
