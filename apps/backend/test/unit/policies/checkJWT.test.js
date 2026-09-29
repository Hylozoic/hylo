// Signing in with a link (GET/POST /noo/login/jwt): only sign-in tokens sign someone in
import { createUnsubscribeToken } from '../../../lib/email/unsubscribeToken'
const rootPath = require('root-path')
require(rootPath('test/setup'))
const checkJWT = require(rootPath('api/policies/checkJWT'))
const factories = require(rootPath('test/setup/factories'))

describe('checkJWT', () => {
  let user

  before(async () => {
    user = await factories.user().save()
  })

  // Resolves with what the policy did: 'next' (signed in), 'refused', 'redirect' or 'error'
  const signInWith = (token, method = 'POST') => new Promise(resolve => {
    const req = factories.mock.request()
    req.method = method
    req.url = '/noo/login/jwt'
    req.headers = { authorization: `Bearer ${token}` }
    const res = factories.mock.response()
    res.status = () => ({ send: () => resolve({ outcome: 'refused', req }) })
    res.redirect = () => resolve({ outcome: 'redirect', req })
    res.forbidden = () => resolve({ outcome: 'refused', req })
    res.serverError = () => resolve({ outcome: 'error', req })
    checkJWT(req, res, () => resolve({ outcome: 'next', req }))
  })

  it('signs someone in with a sign-in token', async () => {
    const { outcome, req } = await signInWith(user.generateJWT())
    expect(outcome).to.equal('next')
    expect(req.session.userId).to.equal(user.id)
  })

  it('does not accept an email unsubscribe token', async () => {
    const token = createUnsubscribeToken({ userId: user.id, descriptor: 'group_digest', groupId: 5 })
    const { outcome, req } = await signInWith(token)
    expect(outcome).to.equal('refused')
    expect(req.session.userId).to.equal(undefined)
  })

  it('does not sign anyone in with a token made for another purpose', async () => {
    const token = user.generateJWT({ action: 'notification_settings' })
    expect((await signInWith(token)).outcome).to.equal('refused')
    expect((await signInWith(token, 'GET')).outcome).to.equal('redirect')
  })
})
