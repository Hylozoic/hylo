import setup from '../../setup'
import factories from '../../setup/factories'
import RedisClient from '../../../api/services/RedisClient'

describe('session handling', () => {
  let user

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
  })

  // Minimal stand-in for an express-session request: regenerate swaps in a new session object
  const sessionRequest = (data = {}) => {
    const req = { headers: {} }
    const makeSession = (attrs) => Object.assign({
      cookie: {},
      regenerate: spy(cb => {
        req.session = makeSession({})
        cb()
      })
    }, attrs)
    req.session = makeSession(data)
    return req
  }

  describe('UserSession.login', () => {
    it('starts a new session, keeps non-auth data and sets req.userId for the session id prefix', async () => {
      const req = sessionRequest({ returnDomain: 'https://hylo.com', authContext: 'login', userId: 999 })
      const oldSession = req.session

      await UserSession.login(req, user, 'password')

      expect(oldSession.regenerate).to.have.been.called()
      expect(req.session).to.not.equal(oldSession)
      expect(req.session.userId).to.equal(user.id)
      expect(req.session.returnDomain).to.equal('https://hylo.com')
      expect(req.session.authContext).to.equal('login')
      expect(req.userId).to.equal(user.id)
    })

    it('does not start a new session for per-request token auth', async () => {
      const req = sessionRequest()
      const oldSession = req.session

      await UserSession.login(req, user, 'token')

      expect(oldSession.regenerate).not.to.have.been.called()
      expect(req.session.userId).to.equal(user.id)
    })
  })

  describe('session genid', () => {
    it('prefixes the session id with the user id when logging in', () => {
      expect(sails.config.session.genid({ userId: user.id })).to.match(new RegExp(`^${user.id}:`))
      expect(sails.config.session.genid({})).to.match(/^anon:/)
    })
  })

  describe('User.clearSessionsFor', () => {
    const redis = RedisClient.create()
    const keys = () => ({
      current: `sess:${user.id}:current`,
      other: `sess:${user.id}:other`,
      someoneElse: `sess:${user.id}0:not-mine`
    })

    before(async () => {
      for (const key of Object.values(keys())) await redis.set(key, '{}')
    })

    after(async () => {
      for (const key of Object.values(keys())) await redis.del(key)
    })

    it("removes the user's other sessions and keeps the current one", async () => {
      await User.clearSessionsFor({ userId: user.id, sessionId: `${user.id}:current` })

      expect(await redis.get(keys().current)).to.equal('{}')
      expect(await redis.get(keys().other)).to.equal(null)
      expect(await redis.get(keys().someoneElse)).to.equal('{}')
    })
  })

  describe('User#deactivate', () => {
    let originalClassMethod

    before(() => {
      originalClassMethod = Queue.classMethod
      Queue.classMethod = spy(() => Promise.resolve())
    })

    after(() => {
      Queue.classMethod = originalClassMethod
    })

    it('clears sessions for the right user id', async () => {
      await user.deactivate('abc')
      expect(Queue.classMethod).to.have.been.called.with('User', 'clearSessionsFor', { userId: user.id, sessionId: 'abc' })
      await user.reactivate()
    })
  })
})
