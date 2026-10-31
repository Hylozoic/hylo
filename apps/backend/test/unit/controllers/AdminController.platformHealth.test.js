/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const cacheModule = require(root('lib/platformHealth/cache'))
const RedisClient = require(root('api/services/RedisClient')).default
const AdminController = require(root('api/controllers/AdminController'))

const realGetPlatformHealth = cacheModule.getPlatformHealth

describe('AdminController.platformHealth', () => {
  let req, res, getPlatformHealth, originalCreate

  // The compiled controller reads getPlatformHealth off the module exports at
  // call time, so swapping the export stubs it for these tests.
  before(() => {
    cacheModule.getPlatformHealth = (...args) => getPlatformHealth(...args)
  })

  after(() => {
    cacheModule.getPlatformHealth = realGetPlatformHealth
  })

  beforeEach(() => {
    req = factories.mock.request()
    req.headers['X-Requested-With'] = 'hylo-admin'
    res = factories.mock.response()
    originalCreate = RedisClient.create
    RedisClient.create = () => null
  })

  afterEach(() => {
    RedisClient.create = originalCreate
  })

  it('returns 400 without the X-Requested-With header, before computing anything', async () => {
    getPlatformHealth = spy(async () => ({ status: 'ready', cached: true, result: {} }))
    delete req.headers['X-Requested-With']
    await AdminController.platformHealth(req, res)
    expect(res.badRequest).to.have.been.called()
    expect(res.body.error).to.match(/X-Requested-With/)
    expect(getPlatformHealth).not.to.have.been.called()
  })

  it('returns 400 for a bad asOf', async () => {
    getPlatformHealth = realGetPlatformHealth
    req.params.asOf = "2026-01-01'; drop table users;--"
    await AdminController.platformHealth(req, res)
    expect(res.badRequest).to.have.been.called()
    expect(res.body.error).to.match(/asOf must be/)
    expect(res.ok).not.to.have.been.called()
  })

  it('returns 400 for a future asOf', async () => {
    getPlatformHealth = realGetPlatformHealth
    req.params.asOf = '2999-01-01'
    await AdminController.platformHealth(req, res)
    expect(res.badRequest).to.have.been.called()
    expect(res.body.error).to.match(/future/)
  })

  it('returns 200 with status ready when the result is available', async () => {
    const fakeRedis = { name: 'redis' }
    RedisClient.create = () => fakeRedis
    getPlatformHealth = spy(async () => ({
      status: 'ready',
      cached: true,
      result: { asOf: '2026-03-27T00:00:00.000Z', sections: [{ id: 's' }] }
    }))
    req.params.asOf = '2026-03-27'
    req.params.refresh = '1'

    await AdminController.platformHealth(req, res)

    expect(getPlatformHealth).to.have.been.called.once
    const args = getPlatformHealth.__spy.calls[0][0]
    expect(args.redis).to.equal(fakeRedis)
    expect(args.asOf).to.equal('2026-03-27')
    expect(args.refresh).to.equal(true)
    expect(args.knex).to.equal(bookshelf.knex)
    expect(res.ok).to.have.been.called()
    expect(res.status).not.to.have.been.called()
    expect(res.body).to.deep.equal({
      status: 'ready',
      cached: true,
      asOf: '2026-03-27T00:00:00.000Z',
      sections: [{ id: 's' }]
    })
  })

  it('passes refresh=false unless refresh is 1 or true', async () => {
    getPlatformHealth = spy(async () => ({ status: 'ready', cached: true, result: {} }))
    req.params.refresh = 'yes'
    await AdminController.platformHealth(req, res)
    expect(getPlatformHealth.__spy.calls[0][0].refresh).to.equal(false)
  })

  it('returns 202 when the result is still computing', async () => {
    getPlatformHealth = spy(async () => ({ status: 'computing', startedAt: '2026-03-27T00:00:01.000Z' }))
    await AdminController.platformHealth(req, res)
    expect(res.statusCode).to.equal(202)
    expect(res.body).to.deep.equal({ status: 'computing', startedAt: '2026-03-27T00:00:01.000Z' })
    expect(res.ok).not.to.have.been.called()
  })

  it('returns 500 when the stored computation failed', async () => {
    getPlatformHealth = spy(async () => ({ status: 'error', error: 'boom' }))
    await AdminController.platformHealth(req, res)
    expect(res.statusCode).to.equal(500)
    expect(res.body).to.deep.equal({ status: 'error', error: 'boom' })
  })

  it('returns 503 when the cache is unavailable', async () => {
    getPlatformHealth = spy(async () => ({ status: 'unavailable', error: 'The platform health cache is unavailable.' }))
    await AdminController.platformHealth(req, res)
    expect(res.statusCode).to.equal(503)
    expect(res.body.status).to.equal('unavailable')
    expect(res.ok).not.to.have.been.called()
  })

  it('returns 400 for a date-time asOf, since only whole days are accepted', async () => {
    getPlatformHealth = realGetPlatformHealth
    req.params.asOf = '2026-03-27T12:00:00Z'
    await AdminController.platformHealth(req, res)
    expect(res.badRequest).to.have.been.called()
  })

  it('returns a server error for unexpected failures', async () => {
    getPlatformHealth = spy(async () => { throw new Error('db down') })
    await AdminController.platformHealth(req, res)
    expect(res.serverError).to.have.been.called()
    expect(res.statusCode).to.equal(500)
    expect(res.body).to.deep.equal({ error: 'db down' })
  })
})
