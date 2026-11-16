import { expect } from 'chai'
import '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import OpenCollectiveController from '../../../api/controllers/OpenCollectiveController'

describe('OpenCollectiveController.webhook', () => {
  let req, res, syncCalls, originalSecret

  beforeEach(() => {
    originalSecret = process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET
    process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET = 'webhook-secret-123'
    req = factories.mock.request()
    res = factories.mock.response()
    syncCalls = []
    // The controller uses the Sails global, so stub that one
    mockify(OpenCollectiveService, 'syncOrders', opts => {
      syncCalls.push(opts)
      return Promise.resolve({ skipped: false, count: 1 })
    })
  })

  afterEach(() => {
    unspyify(OpenCollectiveService, 'syncOrders')
    if (originalSecret === undefined) delete process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET
    else process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET = originalSecret
  })

  it('ignores calls without the secret path segment', async () => {
    req.params = { secret: 'wrong' }
    await OpenCollectiveController.webhook(req, res)
    expect(res.statusCode).to.equal(404)
    expect(syncCalls).to.have.length(0)
  })

  it('is disabled when no secret is configured', async () => {
    delete process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET
    req.params = { secret: '' }
    await OpenCollectiveController.webhook(req, res)
    expect(res.statusCode).to.equal(404)
    expect(syncCalls).to.have.length(0)
  })

  it('treats the payload only as a hint to re-sync from the API', async () => {
    req.params = { secret: 'webhook-secret-123' }
    req.body = { type: 'order.processed', data: { order: { id: 123, totalAmount: 999999 } } }
    await OpenCollectiveController.webhook(req, res)
    expect(res.body).to.deep.equal({ received: true })
    expect(syncCalls).to.deep.equal([{ minIntervalMs: 30000 }])
    expect(await bookshelf.knex('open_collective_orders').count('id as n').first()).to.deep.equal({ n: '0' })
  })
})
