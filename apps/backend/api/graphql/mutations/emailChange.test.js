/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { RATE_LIMITED_ERROR } from '../../../lib/rateLimit'
import { updateMe } from './index'
import { sendPasswordReset } from './user'
import {
  EMAIL_CHANGE_TTL,
  PENDING_EMAIL_SETTING,
  cancelEmailChange,
  getPendingEmail,
  maskEmail,
  verifyEmailChange as verifyEmailChangeWith
} from './emailChange'

const fetchOne = (type, id) => ({ type, id })
const verifyEmailChange = verifyEmailChangeWith(fetchOne)

describe('email change', () => {
  let user, queued, oldEmail

  const emailsSent = method => queued.filter(([, name]) => name === method).map(([, , opts]) => opts)
  const lastVerification = () => {
    const opts = emailsSent('sendEmailVerification').slice(-1)[0]
    return {
      email: opts.email,
      code: opts.templateData.code,
      token: new URL(opts.templateData.verify_url).searchParams.get('emailChangeToken')
    }
  }
  const reload = () => User.find(user.id)
  const uniqueEmail = () => `${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async () => {
    queued = []
    mockify(Queue, 'classMethod', (...args) => { queued.push(args); return Promise.resolve() })
    oldEmail = uniqueEmail()
    user = await factories.user({ email: oldEmail, email_validated: true }).save()
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  describe('requesting a change via updateMe', () => {
    it('keeps the current email and stores the new one as pending', async () => {
      const newEmail = uniqueEmail()
      await updateMe('session', user.id, { email: newEmail.toUpperCase(), name: 'New Name' })

      const fresh = await reload()
      expect(fresh.get('email')).to.equal(oldEmail)
      expect(fresh.get('name')).to.equal('New Name')
      expect(getPendingEmail(fresh)).to.equal(newEmail)
      // The code itself is never stored
      expect(JSON.stringify(fresh.get('settings'))).not.to.include(lastVerification().code)
    })

    it('sends a code and link to the new address and a notice without them to the old one', async () => {
      const newEmail = uniqueEmail()
      await updateMe('session', user.id, { email: newEmail })

      const verification = emailsSent('sendEmailVerification')
      expect(verification.length).to.equal(1)
      expect(verification[0].email).to.equal(newEmail)
      expect(verification[0].templateData.code).to.match(/^\d{6}$/)
      expect(verification[0].templateData.verify_url).to.include('/my/account?emailChangeToken=')

      const notice = emailsSent('sendEmailChangeRequested')
      expect(notice.length).to.equal(1)
      expect(notice[0].email).to.equal(oldEmail)
      expect(notice[0].templateData.masked_new_email).to.equal(maskEmail(newEmail))
      const noticeText = JSON.stringify(notice[0])
      expect(noticeText).not.to.include(newEmail)
      expect(noticeText).not.to.include(verification[0].templateData.code)
      expect(noticeText).not.to.include(lastVerification().token)
    })

    it('rejects an invalid email without saving other changes', async () => {
      await expect(updateMe('session', user.id, { email: 'not-an-email', name: 'Changed' }))
        .to.be.rejectedWith('invalid-email')
      const fresh = await reload()
      expect(fresh.get('name')).to.equal(user.get('name'))
      expect(getPendingEmail(fresh)).to.be.null
      expect(queued).to.be.empty
    })

    it('rejects an email used by another account, ignoring case, as before', async () => {
      const other = await factories.user({ email: uniqueEmail() }).save()
      await expect(updateMe('session', user.id, { email: other.get('email').toUpperCase() }))
        .to.be.rejectedWith('duplicate-email')
      expect(getPendingEmail(await reload())).to.be.null
      expect(queued).to.be.empty
    })

    it('counts duplicate-email answers towards the request limit', async () => {
      const other = await factories.user({ email: uniqueEmail() }).save()
      for (let i = 0; i < 5; i++) {
        await expect(updateMe('session', user.id, { email: other.get('email') })).to.be.rejectedWith('duplicate-email')
      }
      await expect(updateMe('session', user.id, { email: other.get('email') })).to.be.rejectedWith(RATE_LIMITED_ERROR)
    })

    it('does nothing when the email is the current one in a different case', async () => {
      await updateMe('session', user.id, { email: oldEmail.toUpperCase() })
      const fresh = await reload()
      expect(fresh.get('email')).to.equal(oldEmail)
      expect(getPendingEmail(fresh)).to.be.null
      expect(queued).to.be.empty
    })

    it('rate limits requests using the existing sendEmailVerification limit', async () => {
      for (let i = 0; i < 5; i++) {
        await updateMe('session', user.id, { email: uniqueEmail() }, { ip: '10.0.0.1' })
      }
      // 5 notices have now gone to the old address
      await expect(updateMe('session', user.id, { email: uniqueEmail() }, { ip: '10.0.0.1' }))
        .to.be.rejectedWith(RATE_LIMITED_ERROR)
    })
  })

  describe('verifying', () => {
    let newEmail

    beforeEach(async () => {
      newEmail = uniqueEmail()
      await updateMe('session', user.id, { email: newEmail })
    })

    it('changes the email with the code, once', async () => {
      const { code } = lastVerification()
      const result = await verifyEmailChange(user.id, { code })
      expect(result).to.deep.equal({ me: { type: 'Me', id: user.id } })

      const fresh = await reload()
      expect(fresh.get('email')).to.equal(newEmail)
      expect(fresh.get('email_validated')).to.be.true
      expect(fresh.getSetting(PENDING_EMAIL_SETTING)).to.be.undefined

      expect(await verifyEmailChange(user.id, { code })).to.deep.equal({ error: 'invalid-code' })
    })

    it('changes the email with the link token', async () => {
      const { token } = lastVerification()
      expect(await verifyEmailChange(user.id, { token })).to.have.property('me')
      expect((await reload()).get('email')).to.equal(newEmail)
    })

    it('rejects a wrong code and keeps the current email', async () => {
      const { code } = lastVerification()
      const wrong = code === '000000' ? '000001' : '000000'
      expect(await verifyEmailChange(user.id, { code: wrong })).to.deep.equal({ error: 'invalid-code' })
      expect((await reload()).get('email')).to.equal(oldEmail)
    })

    it('limits wrong code guesses', async () => {
      const { code } = lastVerification()
      const wrong = code === '000000' ? '000001' : '000000'
      for (let i = 0; i < 10; i++) await verifyEmailChange(user.id, { code: wrong })
      expect(await verifyEmailChange(user.id, { code })).to.deep.equal({ error: RATE_LIMITED_ERROR })
      expect((await reload()).get('email')).to.equal(oldEmail)
    })

    it("rejects another user's token", async () => {
      const { token } = lastVerification()
      const other = await factories.user({ email: uniqueEmail() }).save()
      await updateMe('session', other.id, { email: uniqueEmail() })
      expect(await verifyEmailChange(other.id, { token })).to.deep.equal({ error: 'invalid-link' })
    })

    it('rejects tokens minted for other purposes', async () => {
      const { token } = await UserVerificationCode.create(newEmail)
      expect(await verifyEmailChange(user.id, { token })).to.deep.equal({ error: 'invalid-link' })
      expect(await verifyEmailChange(user.id, { token: user.generateJWT() })).to.deep.equal({ error: 'invalid-link' })
    })

    it('invalidates the earlier code and link when a new change is requested', async () => {
      const first = lastVerification()
      const secondEmail = uniqueEmail()
      await updateMe('session', user.id, { email: secondEmail })

      expect(await verifyEmailChange(user.id, { token: first.token })).to.deep.equal({ error: 'invalid-link' })
      // The 6 digit codes may collide by chance, so only check the old code when they differ
      if (first.code !== lastVerification().code) {
        expect(await verifyEmailChange(user.id, { code: first.code })).to.deep.equal({ error: 'invalid-code' })
      }
      expect(getPendingEmail(await reload())).to.equal(secondEmail)

      await verifyEmailChange(user.id, { token: lastVerification().token })
      expect((await reload()).get('email')).to.equal(secondEmail)
    })

    it('expires after the same time as signup verification codes', async () => {
      const { code } = lastVerification()
      const fresh = await reload()
      const pending = fresh.getSetting(PENDING_EMAIL_SETTING)
      await fresh.addSetting({
        [PENDING_EMAIL_SETTING]: { ...pending, requested_at: new Date(Date.now() - EMAIL_CHANGE_TTL - 1000).toISOString() }
      }, true)

      expect(getPendingEmail(await reload())).to.be.null
      expect(await verifyEmailChange(user.id, { code })).to.deep.equal({ error: 'invalid-code' })
      const after = await reload()
      expect(after.get('email')).to.equal(oldEmail)
      expect(after.getSetting(PENDING_EMAIL_SETTING)).to.be.undefined
    })

    it('rechecks that the email is still free at verification time', async () => {
      const { code } = lastVerification()
      // Someone else signs up with the address (in a different case) before it is verified
      await factories.user({ email: newEmail.toUpperCase() }).save()

      expect(await verifyEmailChange(user.id, { code })).to.deep.equal({ error: 'duplicate-email' })
      const fresh = await reload()
      expect(fresh.get('email')).to.equal(oldEmail)
      expect(fresh.getSetting(PENDING_EMAIL_SETTING)).to.be.undefined
    })

    it('stops working once cancelled', async () => {
      const { code } = lastVerification()
      expect(await cancelEmailChange(user.id)).to.deep.equal({ success: true })
      expect(getPendingEmail(await reload())).to.be.null
      expect(await verifyEmailChange(user.id, { code })).to.deep.equal({ error: 'invalid-code' })
      expect((await reload()).get('email')).to.equal(oldEmail)
    })

    it('keeps login and password reset on the current email until verified', async () => {
      expect((await User.find(oldEmail)).id).to.equal(user.id)
      expect(await User.find(newEmail)).to.not.exist

      queued = []
      await sendPasswordReset(null, { email: newEmail }, {})
      expect(emailsSent('sendPasswordReset')).to.be.empty
      await sendPasswordReset(null, { email: oldEmail }, {})
      expect(emailsSent('sendPasswordReset').map(o => o.email)).to.deep.equal([oldEmail])
    })
  })

  it('masks all but the first character of the local part', () => {
    expect(maskEmail('jane.doe@example.com')).to.equal('j***@example.com')
  })
})
