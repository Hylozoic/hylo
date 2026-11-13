import path from 'path'
import { mockify, unspyify } from '../../setup/helpers'

const nock = require('nock')
const Module = require('module')
const root = require('root-path')
require(root('test/setup'))

const SENDWITHUS_SEND_PATH = '/api/v1_0/send'

// A fresh Email.js built on the REAL sendwithus client with a key set, bypassing the stub in test/setup/core.js,
// so only Email.js's own guard stands between a send and the network.
const loadEmailWithRealClient = key => {
  process.env.SENDWITHUS_KEY = key
  const emailPath = root('api/services/Email.js')
  const realSendwithusPath = require.resolve('sendwithus')
  const stubbedRequire = Module.prototype.require
  Module.prototype.require = function (id) {
    return stubbedRequire.call(this, id === 'sendwithus' ? realSendwithusPath : id)
  }
  const cached = require.cache[emailPath]
  delete require.cache[emailPath]
  try {
    const loaded = require(emailPath)
    // This copy is evicted from the cache below, so callers that need its Sentry
    // cannot look the dependency up on the module the rest of the suite uses.
    const loadedModule = require.cache[emailPath]
    loaded.__sentry = loadedModule && loadedModule.children.find(m => m.id.endsWith(`${path.sep}lib${path.sep}sentry.js`))?.exports
    return loaded
  } finally {
    Module.prototype.require = stubbedRequire
    // keep the instance the rest of the suite (and sails' global Email) uses
    if (cached) require.cache[emailPath] = cached
    else delete require.cache[emailPath]
  }
}

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
        var address = `"${email}" <${email}>`

        expect(Email.decodePostReplyAddress(address)).to.deep.equal({postId, userId})
      })
    })
  })

  // #1722: sendwithus delivers mail sent with a *test* key to the account owner, so tests must never send.
  describe('in tests', () => {
    let previousEnv

    beforeEach(() => {
      previousEnv = {
        NODE_ENV: process.env.NODE_ENV,
        SENDWITHUS_KEY: process.env.SENDWITHUS_KEY,
        DISABLE_EMAIL_SENDING: process.env.DISABLE_EMAIL_SENDING
      }
      nock.disableNetConnect()
    })

    afterEach(() => {
      Object.entries(previousEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      })
      nock.enableNetConnect()
    })

    const interceptSendwithus = () =>
      nock('https://api.sendwithus.com').post(/.*/).reply(200, { success: true })

    it('blanks SENDWITHUS_KEY and stubs the sendwithus client', done => {
      expect(previousEnv.SENDWITHUS_KEY).to.equal('')
      require('sendwithus')('test_dummy').send({}, err => {
        expect(err.message).to.match(/stubbed in tests/)
        done()
      })
    })

    it('does not send under NODE_ENV=test even with a real client and a key', async () => {
      const scope = interceptSendwithus()
      const RealEmail = loadEmailWithRealClient('test_dummy')

      expect(await RealEmail.sendSimpleEmail('someone@example.com', 'tem_x', {})).to.equal(false)
      expect(await RealEmail.sendPasswordReset({ email: 'someone@example.com', templateData: {} })).to.equal(false)
      expect(await RealEmail.sendInvitation('someone@example.com', { inviter_name: 'Joe' })).to.equal(false)
      expect(await RealEmail.sendCommentDigest({ email: 'someone@example.com', data: {} })).to.equal(false)
      expect(scope.isDone()).to.equal(false)
    })

    it('does not send when DISABLE_EMAIL_SENDING=1 (isolated E2E backend)', async () => {
      const scope = interceptSendwithus()
      const RealEmail = loadEmailWithRealClient('test_dummy')
      process.env.NODE_ENV = 'development'
      process.env.DISABLE_EMAIL_SENDING = '1'

      expect(await RealEmail.sendSimpleEmail('someone@example.com', 'tem_x', {})).to.equal(false)
      expect(scope.isDone()).to.equal(false)
    })

    it('would reach sendwithus outside tests (shows the checks above can see a send)', async () => {
      const scope = interceptSendwithus()
      const RealEmail = loadEmailWithRealClient('test_dummy')
      process.env.NODE_ENV = 'development'
      delete process.env.DISABLE_EMAIL_SENDING

      expect(await RealEmail.sendSimpleEmail('someone@example.com', 'tem_x', {})).to.deep.equal({ success: true })
      expect(scope.isDone()).to.equal(true)
    })
  })

  describe('delivery failures', () => {
    const recipient = 'failing-recipient@example.com'
    let previousEnv

    beforeEach(() => {
      previousEnv = {
        NODE_ENV: process.env.NODE_ENV,
        SENDWITHUS_KEY: process.env.SENDWITHUS_KEY,
        DISABLE_EMAIL_SENDING: process.env.DISABLE_EMAIL_SENDING
      }
      // The send guard refuses NODE_ENV=test. These tests have to leave that mode
      // so a nocked SendWithUs response can exercise the failure report.
      process.env.NODE_ENV = 'development'
      delete process.env.DISABLE_EMAIL_SENDING
      nock.disableNetConnect()
    })

    afterEach(() => {
      Object.entries(previousEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      })
      nock.cleanAll()
      nock.enableNetConnect()
    })

    it('resolves false and reports the template to Sentry without the recipient', async () => {
      nock('https://api.sendwithus.com').post(SENDWITHUS_SEND_PATH).reply(500, { success: false })
      const RealEmail = loadEmailWithRealClient('test_dummy')
      const realSentry = RealEmail.__sentry
      mockify(realSentry, 'error', () => {})

      try {
        const result = await RealEmail.sendPostNotification({ email: recipient, data: { post: { title: 'hi' } } })

        expect(result).to.equal(false)
        expect(realSentry.error).to.have.been.called.exactly(1)
        const [error, , extra] = realSentry.error.__spy.calls[0]
        expect(error).to.be.an.instanceof(Error)
        expect(extra.templateId).to.equal('tem_cPYpXw7d9pCdm6M8QmtPvPGG')
        expect(extra.statusCode).to.equal(500)
        expect(JSON.stringify(extra)).not.to.contain(recipient)
      } finally {
        unspyify(realSentry, 'error')
      }
    })

    it('resolves the SendWithUs response when the send succeeds', async () => {
      nock('https://api.sendwithus.com').post(SENDWITHUS_SEND_PATH).reply(200, { success: true, status: 'OK' })
      const RealEmail = loadEmailWithRealClient('test_dummy')
      const realSentry = RealEmail.__sentry
      mockify(realSentry, 'error', () => {})

      try {
        const result = await RealEmail.sendPostNotification({ email: recipient, data: {} })

        expect(result).to.deep.equal({ success: true, status: 'OK' })
        expect(realSentry.error).not.to.have.been.called()
      } finally {
        unspyify(realSentry, 'error')
      }
    })
  })

  describe('headers', () => {
    let sentBody
    let previousEnv
    let RealEmail

    beforeEach(() => {
      previousEnv = {
        NODE_ENV: process.env.NODE_ENV,
        SENDWITHUS_KEY: process.env.SENDWITHUS_KEY,
        DISABLE_EMAIL_SENDING: process.env.DISABLE_EMAIL_SENDING
      }
      process.env.NODE_ENV = 'development'
      delete process.env.DISABLE_EMAIL_SENDING
      nock.disableNetConnect()
      RealEmail = loadEmailWithRealClient('test_dummy')
    })

    afterEach(() => {
      Object.entries(previousEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      })
      nock.cleanAll()
      nock.enableNetConnect()
    })

    const captureSend = () => {
      sentBody = null
      nock('https://api.sendwithus.com')
        .post(SENDWITHUS_SEND_PATH, body => { sentBody = body; return true })
        .reply(200, { success: true })
    }

    it('sends account emails without Precedence: bulk', async () => {
      for (const send of ['sendPasswordReset', 'sendEmailVerification', 'sendFinishRegistration', 'sendEmailChangeRequested']) {
        captureSend()
        await RealEmail[send]({ email: 'member@example.com', templateData: {}, locale: 'es' })
        expect(sentBody.headers, send).to.deep.equal({ 'X-Auto-Response-Suppress': 'All' })
        expect(sentBody.locale, send).to.equal('es-ES')
        expect(sentBody.sender.name, send).to.equal('The Team at Hylo')
      }
    })

    it('sends purchase and refund receipts without Precedence: bulk', async () => {
      for (const send of ['sendPurchaseConfirmation', 'sendTrackAccessPurchased', 'sendSubscriptionRenewed', 'sendRefundProcessed']) {
        captureSend()
        await RealEmail[send]({ email: 'member@example.com', data: {}, locale: 'en' })
        expect(sentBody.headers, send).to.deep.equal({ 'X-Auto-Response-Suppress': 'All' })
      }
    })

    it('keeps Precedence: bulk on digests and notifications', async () => {
      captureSend()
      await RealEmail.sendSimpleEmail('member@example.com', 'tem_t7rmGfJKvqXrvmrVWJjjWkg4', {}, { version: 'Spaces' })
      expect(sentBody.headers).to.deep.equal({ Precedence: 'bulk', 'X-Auto-Response-Suppress': 'All' })

      captureSend()
      await RealEmail.sendCommentDigest({ email: 'member@example.com', data: {} })
      expect(sentBody.headers).to.deep.equal({ Precedence: 'bulk', 'X-Auto-Response-Suppress': 'All' })
    })
  })
})
