/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai')
const { getPlatformHealth, keysFor, LOCK_KEY, LOCK_TTL_SECONDS } = require('../../../../lib/platformHealth/cache')
const { InvalidAsOfError } = require('../../../../lib/platformHealth/sql')

function fakeRedis () {
  const store = new Map()
  const ttls = new Map()
  return {
    store,
    ttls,
    get: spy(async key => (store.has(key) ? store.get(key) : null)),
    set: spy(async (key, value, ...args) => {
      const nx = args.includes('NX')
      if (nx && store.has(key)) return null
      store.set(key, String(value))
      const exIndex = args.indexOf('EX')
      if (exIndex >= 0) ttls.set(key, args[exIndex + 1])
      return 'OK'
    }),
    del: spy(async key => {
      const had = store.delete(key)
      ttls.delete(key)
      return had ? 1 : 0
    })
  }
}

function deferred () {
  let resolve, reject
  const promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setImmediate(resolve))
const lockHolder = redis => JSON.parse(redis.store.get(LOCK_KEY))

describe('platformHealth/cache', () => {
  const knex = { name: 'fake-knex' }
  const liveKeys = keysFor(null)
  let redis, pending, run

  beforeEach(() => {
    redis = fakeRedis()
    pending = []
    run = spy(() => {
      const d = deferred()
      pending.push(d)
      return d.promise
    })
  })

  it('keysFor uses "live" when there is no asOf', () => {
    expect(keysFor(null).result).to.equal('platform-health:v3:result:live')
    expect(keysFor('2026-03-27T00:00:00.000Z').error).to.equal('platform-health:v3:error:2026-03-27T00:00:00.000Z')
  })

  it('returns a cached result as ready without running', async () => {
    redis.store.set(liveKeys.result, JSON.stringify({ asOf: 'x', sections: [] }))
    const outcome = await getPlatformHealth({ knex, redis, run })
    expect(outcome).to.deep.equal({ status: 'ready', cached: true, result: { asOf: 'x', sections: [] } })
    expect(run).not.to.have.been.called()
  })

  it('starts a background run on a miss and returns computing', async () => {
    const outcome = await getPlatformHealth({ knex, redis, run })
    expect(outcome.status).to.equal('computing')
    expect(outcome.busyWith).to.equal('live')
    expect(run).to.have.been.called.once
    expect(run).to.have.been.called.with({ knex, asOf: null })
    expect(lockHolder(redis)).to.include({ asOf: 'live', startedAt: outcome.startedAt })
    expect(lockHolder(redis).token).to.be.a('string')
    expect(redis.ttls.get(LOCK_KEY)).to.equal(LOCK_TTL_SECONDS)
  })

  it('does not start another run while the lock is held', async () => {
    const first = await getPlatformHealth({ knex, redis, run })
    const second = await getPlatformHealth({ knex, redis, run })
    expect(second).to.deep.equal({ status: 'computing', startedAt: first.startedAt, busyWith: 'live' })
    expect(run).to.have.been.called.once
  })

  it('runs only one computation at a time across all dates', async () => {
    await getPlatformHealth({ knex, redis, run })
    const other = await getPlatformHealth({ knex, redis, run, asOf: '2026-03-27' })
    expect(other.status).to.equal('computing')
    expect(other.busyWith).to.equal('live')
    expect(run).to.have.been.called.once

    pending[0].resolve({ asOf: 'now' })
    await flush()
    const next = await getPlatformHealth({ knex, redis, run, asOf: '2026-03-27' })
    expect(next.busyWith).to.equal('2026-03-27T00:00:00.000Z')
    expect(run).to.have.been.called.twice
  })

  it('stores the result when the run completes and releases the lock', async () => {
    await getPlatformHealth({ knex, redis, run })
    pending[0].resolve({ asOf: 'now', sections: [{ id: 's' }] })
    await flush()

    expect(JSON.parse(redis.store.get(liveKeys.result))).to.deep.equal({ asOf: 'now', sections: [{ id: 's' }] })
    expect(redis.ttls.get(liveKeys.result)).to.equal(15 * 60)
    expect(redis.store.has(LOCK_KEY)).to.equal(false)

    const outcome = await getPlatformHealth({ knex, redis, run })
    expect(outcome).to.deep.equal({ status: 'ready', cached: true, result: { asOf: 'now', sections: [{ id: 's' }] } })
    expect(run).to.have.been.called.once
  })

  it('never releases a lock that another run now owns', async () => {
    await getPlatformHealth({ knex, redis, run })
    // Simulate the first lock expiring and a second run taking over.
    redis.store.delete(LOCK_KEY)
    await getPlatformHealth({ knex, redis, run, refresh: true })
    const secondLock = redis.store.get(LOCK_KEY)

    pending[0].resolve({ first: true })
    await flush()
    expect(redis.store.get(LOCK_KEY)).to.equal(secondLock)

    pending[1].resolve({ second: true })
    await flush()
    expect(redis.store.has(LOCK_KEY)).to.equal(false)
  })

  it('uses an atomic compare-and-delete when redis supports eval', async () => {
    redis.eval = spy(async (script, numKeys, key, value) => {
      if (redis.store.get(key) === value) return redis.del(key)
      return 0
    })
    await getPlatformHealth({ knex, redis, run })
    pending[0].resolve({})
    await flush()
    expect(redis.eval).to.have.been.called.once
    expect(redis.store.has(LOCK_KEY)).to.equal(false)
  })

  it('caches historical results under their own key with a longer ttl', async () => {
    const outcome = await getPlatformHealth({ knex, redis, run, asOf: '2026-03-27' })
    expect(outcome.status).to.equal('computing')
    expect(run).to.have.been.called.with({ knex, asOf: '2026-03-27T00:00:00.000Z' })
    pending[0].resolve({ asOf: '2026-03-27T00:00:00.000Z' })
    await flush()

    const keys = keysFor('2026-03-27T00:00:00.000Z')
    expect(redis.store.has(keys.result)).to.equal(true)
    expect(redis.ttls.get(keys.result)).to.equal(24 * 60 * 60)
    expect(redis.store.has(liveKeys.result)).to.equal(false)
  })

  it('stores a failed run and reports error on later polls without restarting', async () => {
    const log = spy()
    await getPlatformHealth({ knex, redis, run, log })
    const failure = new Error('boom')
    pending[0].reject(failure)
    await flush()

    expect(log).to.have.been.called.with(failure)
    expect(redis.store.get(liveKeys.error)).to.equal('boom')
    expect(redis.ttls.get(liveKeys.error)).to.equal(5 * 60)
    expect(redis.store.has(LOCK_KEY)).to.equal(false)

    const second = await getPlatformHealth({ knex, redis, run, log })
    const third = await getPlatformHealth({ knex, redis, run, log })
    expect(second).to.deep.equal({ status: 'error', error: 'boom' })
    expect(third).to.deep.equal({ status: 'error', error: 'boom' })
    expect(run).to.have.been.called.once
  })

  it('restarts after an error when refresh is true, clearing the stored error', async () => {
    await getPlatformHealth({ knex, redis, run })
    pending[0].reject(new Error('boom'))
    await flush()

    const outcome = await getPlatformHealth({ knex, redis, run, refresh: true })
    expect(outcome.status).to.equal('computing')
    expect(run).to.have.been.called.twice
    expect(redis.store.has(liveKeys.error)).to.equal(false)
  })

  it('restarts a cached result when refresh is true, clearing the stale result', async () => {
    redis.store.set(liveKeys.result, JSON.stringify({ old: true }))
    const outcome = await getPlatformHealth({ knex, redis, run, refresh: true })
    expect(outcome.status).to.equal('computing')
    expect(run).to.have.been.called.once
    expect(redis.store.has(liveKeys.result)).to.equal(false)

    pending[0].resolve({ fresh: true })
    await flush()
    expect(JSON.parse(redis.store.get(liveKeys.result))).to.deep.equal({ fresh: true })
  })

  it('does not start a second run on refresh while a run is in progress', async () => {
    const first = await getPlatformHealth({ knex, redis, run })
    const second = await getPlatformHealth({ knex, redis, run, refresh: true })
    expect(second).to.deep.equal({ status: 'computing', startedAt: first.startedAt, busyWith: 'live' })
    expect(run).to.have.been.called.once
  })

  it('computes synchronously when there is no redis', async () => {
    const syncRun = spy(async ({ asOf }) => ({ asOf, sections: [] }))
    const outcome = await getPlatformHealth({ knex, redis: null, run: syncRun, asOf: '2026-03-27' })
    expect(outcome).to.deep.equal({
      status: 'ready',
      cached: false,
      result: { asOf: '2026-03-27T00:00:00.000Z', sections: [] }
    })
    expect(syncRun).to.have.been.called.once
  })

  it('reports unavailable without computing when redis fails', async () => {
    const log = spy()
    const redisError = new Error('Reached the max retries per request limit')
    redis.get = spy(async () => { throw redisError })
    const syncRun = spy(async () => ({ sections: [] }))
    const outcome = await getPlatformHealth({ knex, redis, run: syncRun, log })
    expect(outcome.status).to.equal('unavailable')
    expect(outcome.error).to.match(/unavailable/)
    expect(syncRun).not.to.have.been.called()
    expect(log).to.have.been.called.with(redisError)
  })

  it('never starts a run when redis reads work but writes fail', async () => {
    redis.set = spy(async () => { throw new Error('OOM command not allowed') })
    const outcomes = await Promise.all([1, 2, 3].map(() => getPlatformHealth({ knex, redis, run })))
    expect(outcomes.map(o => o.status)).to.deep.equal(['unavailable', 'unavailable', 'unavailable'])
    expect(run).not.to.have.been.called()
  })

  it('holds the lock for longer than every metric could take', () => {
    expect(LOCK_TTL_SECONDS).to.be.at.least(15 * 60)
  })

  it('survives redis failing after a background run finishes without an unhandled rejection', async () => {
    const unhandled = []
    const onUnhandled = reason => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      const log = spy()
      await getPlatformHealth({ knex, redis, run, log })
      redis.set = spy(async () => { throw new Error('redis down') })
      redis.del = spy(async () => { throw new Error('redis down') })
      pending[0].resolve({ sections: [] })
      await flush()
      await flush()
      expect(log).to.have.been.called()
      expect(unhandled).to.deep.equal([])
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }
  })

  it('accepts only whole dates for asOf', async () => {
    await expect(getPlatformHealth({ knex, redis, run, asOf: '2026-03-27T12:00:00Z' })).to.be.rejectedWith(InvalidAsOfError)
    expect(run).not.to.have.been.called()
  })

  it('throws InvalidAsOfError for an invalid asOf before touching redis or running', async () => {
    let caught
    try {
      await getPlatformHealth({ knex, redis, run, asOf: "2026-01-01'; drop table users;--" })
    } catch (err) {
      caught = err
    }
    expect(caught).to.be.an.instanceof(InvalidAsOfError)
    expect(run).not.to.have.been.called()
    expect(redis.get).not.to.have.been.called()
    expect(redis.set).not.to.have.been.called()
  })

  it('throws InvalidAsOfError without redis too', async () => {
    await expect(getPlatformHealth({ knex, redis: null, run, asOf: 'garbage' })).to.be.rejectedWith(InvalidAsOfError)
    expect(run).not.to.have.been.called()
  })
})
