import { touchLastActiveAt } from './touchLastActiveAt'

describe('touchLastActiveAt', () => {
  it('skips api clients and signed-out requests', () => {
    let calls = 0
    const update = () => { calls += 1 }
    touchLastActiveAt({ api_client: {}, session: { userId: 1 } }, update)
    touchLastActiveAt({ session: {} }, update)
    expect(calls).to.equal(0)
  })

  it('writes once per five minutes and records the time on the session', () => {
    let calls = 0
    const update = (userId, at) => {
      calls += 1
      expect(userId).to.equal(7)
      expect(at).to.be.an.instanceof(Date)
      return Promise.resolve()
    }
    const req = { session: { userId: 7 } }
    touchLastActiveAt(req, update)
    touchLastActiveAt(req, update)
    expect(calls).to.equal(1)
    expect(req.session.lastActiveAtTouchedAt).to.be.a('number')

    req.session.lastActiveAtTouchedAt = Date.now() - (5 * 60 * 1000) - 1
    touchLastActiveAt(req, update)
    expect(calls).to.equal(2)
  })

  it('does not reject the request when the update fails', async () => {
    const req = { session: { userId: 7 } }
    touchLastActiveAt(req, () => Promise.reject(new Error('db down')))
    await new Promise(resolve => setImmediate(resolve))
    expect(req.session.lastActiveAtTouchedAt).to.be.a('number')
  })
})
