import crypto from 'crypto'
import { clearRateLimits } from '../../../lib/rateLimit'
import { verifyEmail } from '../../../api/graphql/mutations/user'
import { tagsFrom } from '../../../lib/email/emailEvents'
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const EmailEventsController = require(root('api/controllers/EmailEventsController'))

// A key pair standing in for the webhook's verification key
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')

function signedRequest (events, { sign = true, key = privateKey, secondsAgo = 0 } = {}) {
  const req = factories.mock.request()
  const body = Buffer.from(JSON.stringify(events))
  const timestamp = String(Math.floor(Date.now() / 1000) - secondsAgo)
  req.body = body
  req.headers = sign
    ? {
        'x-twilio-email-event-webhook-timestamp': timestamp,
        'x-twilio-email-event-webhook-signature': crypto.sign('sha256', Buffer.concat([Buffer.from(timestamp), body]), key).toString('base64')
      }
    : {}
  return req
}

describe('EmailEventsController', () => {
  let res, user, group, previousKey

  const receive = async (events, options) => {
    res = factories.mock.response()
    await EmailEventsController.receive(signedRequest(events, options), res)
    await user.refresh()
  }

  before(() => {
    previousKey = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY
  })

  after(() => {
    if (previousKey === undefined) delete process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY
    else process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY = previousKey
  })

  beforeEach(async () => {
    await setup.clearDb()
    process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY = PUBLIC_KEY
    user = await factories.user({ email: 'bounce-me@example.com' }).save()
    group = await factories.group().save()
    await group.addMembers([user.id], { settings: { sendEmail: true, digestFrequency: 'daily' } })
  })

  const membershipSettings = async () => (await GroupMembership.forPair(user.id, group.id).fetch()).get('settings')

  describe('signature', () => {
    it('refuses events without a signature and changes nothing', async () => {
      await receive([{ event: 'bounce', type: 'bounce', email: user.get('email') }], { sign: false })

      expect(res.statusCode).to.equal(403)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('refuses events signed with another key', async () => {
      const { privateKey: otherKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      await receive([{ event: 'bounce', type: 'bounce', email: user.get('email') }], { key: otherKey })

      expect(res.statusCode).to.equal(403)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('refuses an old signed batch sent again', async () => {
      await receive([{ event: 'bounce', type: 'bounce', email: user.get('email') }], { secondsAgo: 60 * 60 })

      expect(res.statusCode).to.equal(403)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('accepts a batch signed a few minutes ago', async () => {
      await receive([{ event: 'bounce', type: 'bounce', email: user.get('email') }], { secondsAgo: 3 * 60 })

      expect(user.get('email_undeliverable_at')).to.be.an.instanceof(Date)
    })

    it('refuses everything when no key is configured', async () => {
      delete process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY
      await receive([{ event: 'bounce', type: 'bounce', email: user.get('email') }])

      expect(res.statusCode).to.equal(503)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })
  })

  describe('bounces', () => {
    it('marks the address undeliverable on a hard bounce, keeping only a short reason', async () => {
      await receive([{ event: 'bounce', type: 'bounce', email: 'Bounce-Me@example.com'.toLowerCase(), bounce_classification: 'Invalid Address', reason: '550 no such user bounce-me@example.com' }])

      expect(res.body).to.deep.equal({ received: 1, handled: 1 })
      expect(user.get('email_undeliverable_at')).to.be.an.instanceof(Date)
      expect(user.get('email_undeliverable_reason')).to.equal('bounce: Invalid Address')
    })

    it('ignores a temporary block', async () => {
      await receive([{ event: 'bounce', type: 'blocked', email: user.get('email') }])

      expect(res.body.handled).to.equal(0)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('marks an address the provider dropped because it bounced before', async () => {
      await receive([{ event: 'dropped', reason: 'Bounced Address', email: user.get('email') }])

      expect(user.get('email_undeliverable_reason')).to.equal('dropped: Bounced Address')
    })

    it('ignores deliveries, opens and other drops', async () => {
      await receive([
        { event: 'delivered', email: user.get('email') },
        { event: 'open', email: user.get('email') },
        { event: 'dropped', reason: 'Unsubscribed Address', email: user.get('email') }
      ])

      expect(res.body).to.deep.equal({ received: 3, handled: 0 })
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('keeps going past an event it cannot handle', async () => {
      await receive([{ event: 'bounce', type: 'bounce' }, null, { event: 'bounce', type: 'bounce', email: user.get('email') }])

      expect(res.body.handled).to.equal(1)
      expect(user.get('email_undeliverable_at')).to.be.an.instanceof(Date)
    })
  })

  describe('spam complaints', () => {
    it("turn off that kind of email: a post email's group email", async () => {
      await receive([{ event: 'spamreport', email: user.get('email'), category: ['hylo_type:sendPostNotification', `hylo_group:${group.id}`] }])

      expect((await membershipSettings()).sendEmail).to.equal(false)
      expect(user.get('settings').email_unsubscribe_scope).to.equal(undefined)
    })

    it("a group digest's complaint sets its digest to Never", async () => {
      await receive([{ event: 'spamreport', email: user.get('email'), category: ['hylo_type:sendSimpleEmail', `hylo_group:${group.id}`] }])

      expect((await membershipSettings()).digestFrequency).to.equal('never')
      expect((await membershipSettings()).sendEmail).to.equal(true)
    })

    it("a comment digest's complaint stops comment email", async () => {
      await receive([{ event: 'spamreport', email: user.get('email'), category: 'hylo_type:sendCommentDigest' }])

      expect(user.get('settings').comment_notifications).to.equal('push')
    })

    it("fall back to 'everything except direct' when the kind of email is unknown", async () => {
      await receive([{ event: 'spamreport', email: user.get('email') }])

      expect(user.get('settings').email_unsubscribe_scope).to.equal('all_but_direct')
      expect((await membershipSettings()).sendEmail).to.equal(true)
    })

    it('keep a stricter choice the person already made', async () => {
      await user.addSetting({ email_unsubscribe_scope: 'everything' }, true)
      await receive([{ event: 'spamreport', email: user.get('email'), category: 'hylo_type:sendWelcomeEmail' }])

      expect(user.get('settings').email_unsubscribe_scope).to.equal('everything')
    })

    it('change nothing for essential email', async () => {
      await receive([{ event: 'spamreport', email: user.get('email'), category: 'hylo_type:sendPasswordReset' }])

      expect(res.body.handled).to.equal(0)
      expect(user.get('settings').email_unsubscribe_scope).to.equal(undefined)
    })

    it('read the tags the provider reports', () => {
      expect(tagsFrom(['hylo_type:sendSimpleEmail', 'hylo_frequency:weekly', 'other'])).to.deep.equal({ sender: 'sendSimpleEmail', groupId: null, frequency: 'weekly', slowedDaily: false })
      expect(tagsFrom(['hylo_type:sendSimpleEmail', 'hylo_frequency:weekly', 'hylo_slowed_daily']).slowedDaily).to.equal(true)
      expect(tagsFrom(undefined)).to.deep.equal({ sender: null, groupId: null, frequency: null, slowedDaily: false })
    })

    it("a weekly unified digest's complaint also stops daily groups it carried for someone away (D9)", async () => {
      await receive([{ event: 'spamreport', email: user.get('email'), category: ['hylo_type:sendSimpleEmail', 'hylo_frequency:weekly', 'hylo_slowed_daily'] }])

      expect((await membershipSettings()).digestFrequency).to.equal('never')
    })
  })

  describe('clearing the flag', () => {
    beforeEach(async () => {
      await user.save({ email_undeliverable_at: new Date(), email_undeliverable_reason: 'bounce' }, { patch: true })
    })

    it('clears when the address changes', async () => {
      await user.validateAndSave(null, { email: 'fixed-address@example.com' })
      await user.refresh()

      expect(user.get('email_undeliverable_at')).to.equal(null)
      expect(user.get('email_undeliverable_reason')).to.equal(null)
    })

    it('stays when other account details change', async () => {
      await user.validateAndSave(null, { tagline: 'Hello' })
      await user.refresh()

      expect(user.get('email_undeliverable_at')).to.be.an.instanceof(Date)
    })

    it('clears when the address is verified again', async () => {
      await clearRateLimits()
      const { code } = await UserVerificationCode.create(user.get('email'))
      const result = await verifyEmail(() => ({}))(null, { email: user.get('email'), code }, { req: { ip: '203.0.113.9', session: {} } })
      await user.refresh()

      expect(result.error).to.equal(undefined)
      expect(user.get('email_undeliverable_at')).to.equal(null)
    })

    it('exposes the flag to the app as Me.emailUndeliverable', async () => {
      const { default: makeModels } = require(root('api/graphql/makeModels'))
      const models = await makeModels(user.id, false, 'test')
      expect(await models.Me.getters.emailUndeliverable(user)).to.equal(true)
    })
  })
})
