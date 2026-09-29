import { createUnsubscribeToken } from '../../../lib/email/unsubscribeToken'
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const UnsubscribeController = require(root('api/controllers/UnsubscribeController'))

describe('UnsubscribeController', () => {
  let req, res, user, group, other, space

  const membershipSettings = async groupId =>
    (await GroupMembership.forPair(user.id, groupId).fetch()).get('settings')

  const withToken = claims => {
    req.params.token = createUnsubscribeToken({ userId: user.id, ...claims })
  }

  const post = async claims => {
    withToken(claims)
    await UnsubscribeController.unsubscribe(req, res)
  }

  beforeEach(async () => {
    await setup.clearDb()
    req = factories.mock.request()
    res = factories.mock.response()
    user = await factories.user({ settings: { comment_notifications: 'both', dm_notifications: 'email' } }).save()
    group = await factories.group({ name: 'Seed Library' }).save()
    other = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
    const settings = { sendEmail: true, sendPushNotifications: true, digestFrequency: 'daily', stewardDigest: true }
    await group.addMembers([user.id], { settings })
    await other.addMembers([user.id], { settings: { ...settings, digestFrequency: 'weekly' } })
    await space.addMembers([user.id], { settings })
  })

  describe('POST (one-click and the confirmation button)', () => {
    it("a group digest's one-click sets that group's digest to Never", async () => {
      await post({ sender: 'sendSimpleEmail', descriptor: 'group_digest', groupId: group.id })

      expect(res.body).to.deep.equal({ success: true, descriptor: 'group_digest', applied: true })
      expect((await membershipSettings(group.id)).digestFrequency).to.equal('never')
      expect((await membershipSettings(other.id)).digestFrequency).to.equal('weekly')
      expect((await membershipSettings(group.id)).sendEmail).to.equal(true)
    })

    it("a space's chat digest turns off its parent group's digest, which governs it", async () => {
      await post({ sender: 'sendChatDigest', descriptor: 'group_digest', groupId: space.id })

      expect((await membershipSettings(group.id)).digestFrequency).to.equal('never')
    })

    it("the unified digest's one-click turns off every digest on its frequency, not unified mode", async () => {
      await user.addSetting({ unified_email_digest: true }, true)
      await post({ sender: 'sendSimpleEmail', descriptor: 'group_digest', frequency: 'daily' })

      expect((await membershipSettings(group.id)).digestFrequency).to.equal('never')
      expect((await membershipSettings(space.id)).digestFrequency).to.equal('never')
      expect((await membershipSettings(other.id)).digestFrequency).to.equal('weekly')
      await user.refresh()
      expect(user.get('settings').unified_email_digest).to.equal(true)
    })

    it("a post notification's one-click turns off that group's email", async () => {
      await post({ sender: 'sendPostNotification', descriptor: 'group_post_email', groupId: group.id })

      expect((await membershipSettings(group.id)).sendEmail).to.equal(false)
      expect((await membershipSettings(group.id)).sendPushNotifications).to.equal(true)
      expect((await membershipSettings(other.id)).sendEmail).to.equal(true)
    })

    it("a comment digest's one-click stops comment email and keeps push", async () => {
      await post({ sender: 'sendCommentDigest', descriptor: 'comment_email' })

      await user.refresh()
      expect(user.get('settings').comment_notifications).to.equal('push')
      expect(user.get('settings').dm_notifications).to.equal('email')
    })

    it("a message digest's one-click stops direct message email", async () => {
      await post({ sender: 'sendMessageDigest', descriptor: 'dm_email' })

      await user.refresh()
      expect(user.get('settings').dm_notifications).to.equal('none')
      expect(user.get('settings').comment_notifications).to.equal('both')
    })

    it('turns off a named membership setting, such as the steward email', async () => {
      await post({ descriptor: 'membership_setting:stewardDigest', groupId: group.id })

      expect((await membershipSettings(group.id)).stewardDigest).to.equal(false)
      expect((await membershipSettings(other.id)).stewardDigest).to.equal(true)
    })

    it('changes nothing for email that links to the settings page', async () => {
      await post({ sender: 'sendWelcomeEmail', descriptor: 'settings_page' })

      expect(res.body.applied).to.equal(false)
      expect((await membershipSettings(group.id)).sendEmail).to.equal(true)
      await user.refresh()
      expect(user.get('settings').comment_notifications).to.equal('both')
    })

    it('is harmless to repeat', async () => {
      await post({ descriptor: 'group_digest', groupId: group.id })
      await post({ descriptor: 'group_digest', groupId: group.id })

      expect(res.body.success).to.equal(true)
      expect((await membershipSettings(group.id)).digestFrequency).to.equal('never')
    })

    it('refuses a missing or invalid token and changes nothing', async () => {
      req.params.token = 'nope'
      await UnsubscribeController.unsubscribe(req, res)

      expect(res.statusCode).to.equal(400)
      expect((await membershipSettings(group.id)).digestFrequency).to.equal('daily')
    })
  })

  describe('GET', () => {
    it('only redirects to the confirmation page, changing nothing', async () => {
      withToken({ descriptor: 'group_digest', groupId: group.id })
      await UnsubscribeController.show(req, res)

      expect(res.redirected).to.match(/\/email\/unsubscribe\?token=/)
      expect(res.redirected).not.to.contain('/noo/')
      expect((await membershipSettings(group.id)).digestFrequency).to.equal('daily')
    })

    it('describes what the link switches off, without changing it', async () => {
      withToken({ descriptor: 'group_digest', groupId: space.id })
      await UnsubscribeController.describe(req, res)

      expect(res.body).to.deep.equal({ descriptor: 'group_digest', groupName: 'Seed Library', frequency: null, done: false })
      expect((await membershipSettings(group.id)).digestFrequency).to.equal('daily')
    })

    it('says when it is already done', async () => {
      await post({ descriptor: 'comment_email' })
      res = factories.mock.response()
      await UnsubscribeController.describe(req, res)

      expect(res.body.done).to.equal(true)
    })

    it('refuses an invalid token', async () => {
      req.params.token = 'nope'
      await UnsubscribeController.describe(req, res)
      expect(res.statusCode).to.equal(400)
    })
  })
})
