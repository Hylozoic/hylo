import { randomUUID } from 'crypto'
import { runPlatformHealth, DEFAULT_CONCURRENCY, STATEMENT_TIMEOUT_MS } from './runner'
import { normalizeRequestedDate } from './sql'
import SECTIONS from './sections'

const KEY_PREFIX = 'platform-health:v3'
const LIVE_TTL_SECONDS = 15 * 60
const HISTORICAL_TTL_SECONDS = 24 * 60 * 60
// knex's default wait for a pool connection.
const ACQUIRE_TIMEOUT_SECONDS = 60
const METRIC_COUNT = SECTIONS.reduce((n, s) => n + s.metrics.length, 0)
// Longer than the worst case: every metric, a few at a time, each waiting for a
// pool connection and then running until its statement timeout.
export const LOCK_TTL_SECONDS = Math.ceil(METRIC_COUNT / DEFAULT_CONCURRENCY) * (ACQUIRE_TIMEOUT_SECONDS + STATEMENT_TIMEOUT_MS / 1000) + 60
const ERROR_TTL_SECONDS = 5 * 60

export const LOCK_KEY = `${KEY_PREFIX}:lock`

export const keysFor = asOf => {
  const suffix = asOf || 'live'
  return {
    result: `${KEY_PREFIX}:result:${suffix}`,
    error: `${KEY_PREFIX}:error:${suffix}`
  }
}

const RELEASE_IF_OWNER = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`

async function releaseLock (redis, lockValue) {
  if (typeof redis.eval === 'function') {
    return redis.eval(RELEASE_IF_OWNER, 1, LOCK_KEY, lockValue)
  }
  if (await redis.get(LOCK_KEY) === lockValue) return redis.del(LOCK_KEY)
  return 0
}

/*
 * Returns the panel data, computing it in the background when it isn't cached.
 * A full computation can outlast an HTTP request (Heroku's router cuts requests
 * at 30s), so callers get { status: 'computing' } and poll until 'ready'.
 * Only one computation runs at a time across all dates. Without Redis (the CLI
 * and tests) the computation runs synchronously instead. If Redis fails, the
 * request gets { status: 'unavailable' }: without the lock, computing here could
 * start a full run for every request.
 */
export async function getPlatformHealth ({ knex, redis, asOf: requestedAsOf, refresh = false, run = runPlatformHealth, log = () => {} }) {
  const asOf = normalizeRequestedDate(requestedAsOf)
  const computeNow = async () => ({ status: 'ready', cached: false, result: await run({ knex, asOf }) })

  if (!redis) return computeNow()

  const keys = keysFor(asOf)
  const guarded = async (fn) => {
    try {
      await fn()
    } catch (err) {
      log(err)
    }
  }

  let lockValue
  let holdsLock = false
  try {
    if (!refresh) {
      const cached = await redis.get(keys.result)
      if (cached) return { status: 'ready', cached: true, result: JSON.parse(cached) }
      // A failed computation is only retried on an explicit refresh, so polling
      // clients don't restart an expensive run every few seconds.
      const error = await redis.get(keys.error)
      if (error) return { status: 'error', error }
    }

    const startedAt = new Date().toISOString()
    lockValue = JSON.stringify({ token: randomUUID(), asOf: asOf || 'live', startedAt })
    const acquired = await redis.set(LOCK_KEY, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX')

    if (!acquired) {
      const holder = JSON.parse(await redis.get(LOCK_KEY) || 'null')
      return { status: 'computing', startedAt: holder && holder.startedAt, busyWith: holder && holder.asOf }
    }
    holdsLock = true

    await redis.del(keys.error)
    if (refresh) await redis.del(keys.result)

    const background = async () => {
      try {
        const result = await run({ knex, asOf })
        await guarded(() => redis.set(keys.result, JSON.stringify(result), 'EX', asOf ? HISTORICAL_TTL_SECONDS : LIVE_TTL_SECONDS))
      } catch (err) {
        log(err)
        await guarded(() => redis.set(keys.error, err.message, 'EX', ERROR_TTL_SECONDS))
      } finally {
        await guarded(() => releaseLock(redis, lockValue))
      }
    }
    holdsLock = false
    background()

    return { status: 'computing', startedAt, busyWith: asOf || 'live' }
  } catch (err) {
    log(err)
    if (holdsLock) await guarded(() => releaseLock(redis, lockValue))
    return { status: 'unavailable', error: 'The platform health cache is unavailable. Try again in a few minutes.' }
  }
}
