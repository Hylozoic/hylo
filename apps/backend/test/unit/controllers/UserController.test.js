var root = require('root-path')
var setup = require(root('test/setup'))
var factories = require(root('test/setup/factories'))
var UserController = require(root('api/controllers/UserController'))
import jwt from 'jsonwebtoken'

describe('UserController', function () {
  let req, res

  beforeEach(function () {
    req = factories.mock.request()
    res = factories.mock.response()
    return setup.clearDb()
  })

  describe('.create', function () {
    beforeEach(async () => {
      Object.assign(res, {
        send: console.error
      })
      User.create = spy(User.create)
      await new Group({ access_code: 'foo', name: 'foo', slug: 'foo' }).save()
    })

    it('rejects requests without a super API client', async () => {
      Object.assign(req.params, {
        name: 'yoyo',
        email: 'anon@bar.com',
        isAdministrator: 'true'
      })
      await UserController.create(req, res)

      expect(res.statusCode).to.equal(403)
      expect(User.create).not.to.have.been.called()
      const testUser = await User.where({ email: 'anon@bar.com' }).fetch()
      expect(testUser).to.not.exist
    })

    it('works with a username and password', async () => {
      req.api_client = { id: 'test-client', name: 'Test', super: true }
      Object.assign(req.params, {
        name: 'yoyo',
        email: 'foo@bar.com',
        password: 'password!'
      })
      await UserController.create(req, res)

      expect(User.create).to.have.been.called()
      expect(res.ok).to.have.been.called()

      const testUser = await User.where({email: 'foo@bar.com'}).fetch()

      expect(testUser.get('active')).to.be.false
      expect(testUser.get('name')).to.equal('yoyo')
    })
  })

  describe('with an existing user', () => {
    describe('.create', () => {
      it('halts on duplicate email', async () => {
        req.api_client = { id: 'test-client', name: 'Test', super: true }
        await factories.user({settings: {leftNavIsOpen: true, currentGroupId: '7'}}).save()
        const testUser = await factories.user().save()
        Object.assign(req.params, { name: 'Sweet', email: testUser.get('email')})
        await UserController.create(req, res)

        expect(res.body).to.deep.equal({ message: 'User already exists' })
      })
    })
  })

  describe('notification settings', () => {
    let user, group1, group2, space

    const membershipSettings = async groupId => {
      const membership = await GroupMembership.forPair(user.id, groupId).fetch()
      return membership.get('settings')
    }

    beforeEach(async () => {
      user = await factories.user({ settings: { digest_frequency: 'daily', post_notifications: 'important' } }).save()
      group1 = await factories.group().save()
      group2 = await factories.group().save()
      space = await factories.group({ type: 'space', parent_id: group1.id }).save()
      await group1.addMembers([user.id], { settings: { digestFrequency: 'weekly', postNotifications: 'all', sendEmail: true } })
      await group2.addMembers([user.id], { settings: { digestFrequency: 'weekly', postNotifications: 'none', sendEmail: true } })
      await space.addMembers([user.id], { settings: { digestFrequency: 'daily', postNotifications: 'all', sendEmail: true } })
      req.params.token = user.generateJWT({ action: 'notification_settings' })
    })

    describe('.getNotificationSettings', () => {
      it('returns the value shared by all memberships, ignoring spaces for the digest', async () => {
        await UserController.getNotificationSettings(req, res)
        expect(res.body.digestFrequency).to.equal('weekly')
      })

      it("returns 'mixed' when memberships differ", async () => {
        await UserController.getNotificationSettings(req, res)
        expect(res.body.postNotifications).to.equal('mixed')
      })

      it('returns the shared post setting when every membership agrees', async () => {
        await GroupMembership.forPair(user.id, group2.id).fetch()
          .then(m => m.addSetting({ postNotifications: 'all' }, true))
        await UserController.getNotificationSettings(req, res)
        expect(res.body.postNotifications).to.equal('all')
      })

      it('rejects a token for another purpose', async () => {
        req.params.token = user.generateJWT()
        await UserController.getNotificationSettings(req, res)
        expect(res.statusCode).to.equal(403)
      })
    })

    describe('.updateNotificationSettings', () => {
      it('fans digestFrequency out to every membership', async () => {
        req.body = { digestFrequency: 'never' }
        await UserController.updateNotificationSettings(req, res)

        expect(res.body).to.deep.equal({ message: 'Notification settings updated' })
        for (const group of [group1, group2, space]) {
          expect((await membershipSettings(group.id)).digestFrequency).to.equal('never')
        }
        await user.refresh()
        expect(user.get('settings').digest_frequency).to.equal('never')
      })

      it('leaves omitted fields untouched on memberships', async () => {
        req.body = { digestFrequency: 'daily' }
        await UserController.updateNotificationSettings(req, res)

        expect((await membershipSettings(group1.id)).postNotifications).to.equal('all')
        expect((await membershipSettings(group2.id)).postNotifications).to.equal('none')
        expect((await membershipSettings(group2.id)).sendEmail).to.equal(true)
      })

      it("treats 'mixed' as unchanged", async () => {
        req.body = { digestFrequency: 'daily', postNotifications: 'mixed' }
        await UserController.updateNotificationSettings(req, res)

        expect((await membershipSettings(group1.id)).postNotifications).to.equal('all')
        expect((await membershipSettings(group2.id)).postNotifications).to.equal('none')
        await user.refresh()
        expect(user.get('settings').post_notifications).to.equal('important')
      })

      it('rejects invalid values without changing anything', async () => {
        req.body = { digestFrequency: 'hourly', postNotifications: 'all' }
        await UserController.updateNotificationSettings(req, res)

        expect(res.statusCode).to.equal(400)
        expect((await membershipSettings(group1.id)).digestFrequency).to.equal('weekly')
        expect((await membershipSettings(group2.id)).postNotifications).to.equal('none')
        await user.refresh()
        expect(user.get('settings').post_notifications).to.equal('important')
      })

      it('does not touch memberships of other users', async () => {
        const other = await factories.user().save()
        await group1.addMembers([other.id], { settings: { digestFrequency: 'weekly' } })
        req.body = { digestFrequency: 'never' }
        await UserController.updateNotificationSettings(req, res)

        const otherMembership = await GroupMembership.forPair(other.id, group1.id).fetch()
        expect(otherMembership.getSetting('digestFrequency')).to.equal('weekly')
      })

      it('keeps unsubscribing from all limited to channels on memberships', async () => {
        req.body = { unsubscribeAll: true }
        await UserController.updateNotificationSettings(req, res)

        const settings = await membershipSettings(group1.id)
        expect(settings.sendEmail).to.equal(false)
        expect(settings.sendPushNotifications).to.equal(false)
        expect(settings.digestFrequency).to.equal('weekly')
        expect(settings.postNotifications).to.equal('all')
      })
    })
  })
})
