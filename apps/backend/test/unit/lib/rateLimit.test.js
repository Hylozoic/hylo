/* eslint-disable no-unused-expressions */
import { RATE_LIMITED_ERROR, authenticateWithRateLimit, clearRateLimits } from '../../../lib/rateLimit'
import { sendPasswordReset, verifyEmail } from '../../../api/graphql/mutations/user'
import factories from '../../setup/factories'
require('../../setup')

// bcrypt hash of 'password'
const PASSWORD_HASH = '$2a$10$UPh85nJvMSrm6gMPqYIS.OPhLjAMbZiFnlpjq1xrtoSBTyV6fMdJS'

describe('login protection', () => {
  let user, socialUser

  before(async () => {
    user = await factories.user({ email: 'ratelimit-user@example.com' }).save()
    await new LinkedAccount({ provider_user_id: PASSWORD_HASH, provider_key: 'password', user_id: user.id }).save()
    socialUser = await factories.user({ email: 'ratelimit-social@example.com' }).save()
    await new LinkedAccount({ provider_user_id: 'google-id', provider_key: 'google', user_id: socialUser.id }).save()
  })

  beforeEach(() => clearRateLimits())

  describe('User.authenticate', () => {
    it('gives the same error for an unknown email, a social-only account and a wrong password', async () => {
      await expect(User.authenticate('nobody-here@example.com', 'password')).to.be.rejectedWith(User.INVALID_LOGIN_ERROR)
      await expect(User.authenticate(socialUser.get('email'), 'password')).to.be.rejectedWith(User.INVALID_LOGIN_ERROR)
      await expect(User.authenticate(user.get('email'), 'wrong')).to.be.rejectedWith(User.INVALID_LOGIN_ERROR)
    })
  })

  describe('authenticateWithRateLimit', () => {
    it('blocks an email after 10 failed attempts, even with the right password', async () => {
      const req = { ip: '203.0.113.1' }
      for (let i = 0; i < 10; i++) {
        await expect(authenticateWithRateLimit(req, user.get('email'), 'wrong')).to.be.rejectedWith(User.INVALID_LOGIN_ERROR)
      }
      await expect(authenticateWithRateLimit({ ip: '203.0.113.2' }, user.get('email'), 'password')).to.be.rejectedWith(RATE_LIMITED_ERROR)
    })

    it('does not count successful logins', async () => {
      for (let i = 0; i < 12; i++) {
        const loggedIn = await authenticateWithRateLimit({ ip: '203.0.113.3' }, user.get('email'), 'password')
        expect(loggedIn.id).to.equal(user.id)
      }
    })

    it('blocks an IP after 50 failed attempts across emails', async () => {
      const req = { ip: '203.0.113.4' }
      for (let i = 0; i < 50; i++) {
        await expect(authenticateWithRateLimit(req, `guess-${i}@example.com`, 'wrong')).to.be.rejected
      }
      await expect(authenticateWithRateLimit(req, user.get('email'), 'password')).to.be.rejectedWith(RATE_LIMITED_ERROR)
    })
  })

  describe('verifyEmail', () => {
    it('stops accepting code guesses after 10 wrong codes', async () => {
      const email = 'ratelimit-verify@example.com'
      const { code } = await UserVerificationCode.create(email)
      const context = { req: { ip: '203.0.113.5', session: {} } }
      const wrongCode = code === '000000' ? '111111' : '000000'

      for (let i = 0; i < 10; i++) {
        expect(await verifyEmail(() => {})(null, { email, code: wrongCode }, context)).to.deep.equal({ error: 'invalid-code' })
      }
      expect(await verifyEmail(() => {})(null, { email, code }, context)).to.deep.equal({ error: RATE_LIMITED_ERROR })
    })
  })

  describe('sendPasswordReset', () => {
    it('sends at most 5 reset emails per address per hour', async () => {
      const context = { req: { ip: '203.0.113.6' } }
      for (let i = 0; i < 5; i++) {
        expect(await sendPasswordReset(null, { email: user.get('email') }, context)).to.deep.equal({ success: true })
      }
      expect(await sendPasswordReset(null, { email: user.get('email') }, context))
        .to.deep.equal({ success: false, error: RATE_LIMITED_ERROR })
    })
  })
})
