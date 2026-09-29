import path from 'path'
import nock from 'nock'
import { dependencyOf, mockify, unspyify } from '../../setup/helpers'
import { emailTypeFor } from '../../../lib/email/emailTypes'
require(require('root-path')('test/setup'))

const SENDWITHUS_SEND_PATH = '/api/v1_0/send'

describe('Email', function () {
  describe('reply address', () => {
    // this expects dev environment variables:
    // INBOUND_EMAIL_SALT=FFFFAAAA123456789
    // INBOUND_EMAIL_DOMAIN=inbound-staging.hylo.com
    // PLAY_APP_SECRET=quxgrault12345678
    const postId = '7823'
    const userId = '5942'
    const email = 'reply-8c26a271fe72895d4e3c20a6893d9c0ee9c9041235c9ce207c0a627196396807@inbound-staging.hylo.com'

    describe('.postReplyAddress', () => {
      it('encrypts the post and user ids', () => {
        expect(Email.postReplyAddress(postId, userId)).to.equal(email)
      })
    })

    describe('.decodePostReplyAddress', () => {
      it('works with human-readable formats', () => {
        const address = `"${email}" <${email}>`

        expect(Email.decodePostReplyAddress(address)).to.deep.equal({ postId, userId })
      })
    })
  })

  describe('delivery failures', () => {
    const recipient = 'failing-recipient@example.com'
    let sentry

    beforeEach(() => {
      sentry = dependencyOf(
        path.resolve(__dirname, '../../../api/services/Email.js'),
        path.resolve(__dirname, '../../../lib/sentry.js')
      )
      mockify(sentry, 'error', () => {})
    })
    afterEach(() => unspyify(sentry, 'error'))

    it('resolves false and reports the template to Sentry without the recipient', async () => {
      nock('https://api.sendwithus.com').post(SENDWITHUS_SEND_PATH).reply(500, { success: false })

      const result = await Email.sendPostNotification({ email: recipient, data: { post: { title: 'hi' } } })

      expect(result).to.equal(false)
      expect(sentry.error).to.have.been.called.exactly(1)
      const [error, , extra] = sentry.error.__spy.calls[0]
      expect(error).to.be.an.instanceof(Error)
      expect(extra.templateId).to.equal('tem_cPYpXw7d9pCdm6M8QmtPvPGG')
      expect(extra.statusCode).to.equal(500)
      expect(JSON.stringify(extra)).not.to.contain(recipient)
    })

    it('resolves the SendWithUs response when the send succeeds', async () => {
      nock('https://api.sendwithus.com').post(SENDWITHUS_SEND_PATH).reply(200, { success: true, status: 'OK' })

      const result = await Email.sendPostNotification({ email: recipient, data: {} })

      expect(result).to.deep.equal({ success: true, status: 'OK' })
      expect(sentry.error).not.to.have.been.called()
    })
  })

  describe('headers', () => {
    let sentBody

    const captureSend = () => {
      sentBody = null
      nock('https://api.sendwithus.com')
        .post(SENDWITHUS_SEND_PATH, body => { sentBody = body; return true })
        .reply(200, { success: true })
    }

    it('sends account emails without Precedence: bulk', async () => {
      for (const send of ['sendPasswordReset', 'sendEmailVerification', 'sendFinishRegistration']) {
        captureSend()
        await Email[send]({ email: 'member@example.com', templateData: {}, locale: 'es' })
        expect(sentBody.headers, send).to.deep.equal({ 'X-Auto-Response-Suppress': 'All' })
        expect(sentBody.locale, send).to.equal('es-ES')
        expect(sentBody.sender.name, send).to.equal('The Team at Hylo')
      }
    })

    it('sends purchase and refund receipts without Precedence: bulk', async () => {
      for (const send of ['sendPurchaseConfirmation', 'sendTrackAccessPurchased', 'sendSubscriptionRenewed', 'sendRefundProcessed']) {
        captureSend()
        await Email[send]({ email: 'member@example.com', data: {}, locale: 'en' })
        expect(sentBody.headers, send).to.deep.equal({ 'X-Auto-Response-Suppress': 'All' })
      }
    })

    it('sends payment-failed and renewal-reminder emails without Precedence: bulk (D84)', async () => {
      for (const send of ['sendPaymentFailed', 'sendSubscriptionRenewalReminder']) {
        captureSend()
        await Email[send]({ email: 'member@example.com', data: {}, locale: 'en' })
        expect(sentBody.headers, send).to.deep.equal({ 'X-Auto-Response-Suppress': 'All' })
      }
    })

    it('marks the payment-failed and renewal reminders essential and the other paid-content notices bulk (D84)', () => {
      for (const send of ['sendPaymentFailed', 'sendSubscriptionRenewalReminder']) {
        expect(emailTypeFor(send).kind, send).to.equal('essential')
      }
      for (const send of ['sendSubscriptionCancelled', 'sendSubscriptionCancelledAdminNotification', 'sendAccessGranted', 'sendAccessExpired']) {
        expect(emailTypeFor(send).kind, send).to.equal('bulk')
      }
    })

    it('keeps cancellation and access notices bulk (D84)', async () => {
      for (const send of ['sendSubscriptionCancelled', 'sendSubscriptionCancelledAdminNotification', 'sendAccessGranted', 'sendAccessExpired']) {
        captureSend()
        await Email[send]({ email: 'member@example.com', data: {}, locale: 'en' })
        expect(sentBody.headers.Precedence, send).to.equal('bulk')
      }
    })

    it('keeps Precedence: bulk on digests and notifications', async () => {
      captureSend()
      await Email.sendSimpleEmail('member@example.com', 'tem_t7rmGfJKvqXrvmrVWJjjWkg4', {}, { version: 'Spaces' })
      expect(sentBody.headers).to.deep.equal({ Precedence: 'bulk', 'X-Auto-Response-Suppress': 'All' })

      captureSend()
      await Email.sendCommentDigest({ email: 'member@example.com', data: {} })
      expect(sentBody.headers).to.deep.equal({ Precedence: 'bulk', 'X-Auto-Response-Suppress': 'All' })
    })
  })
})
