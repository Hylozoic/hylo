/* eslint-disable no-unused-expressions */
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
require('../../setup')

describe('PushNotification', () => {
  let user, pushNotification, tmpEnvVar, notifyCall

  before(async () => {
    tmpEnvVar = process.env.PUSH_NOTIFICATIONS_ENABLED
    user = await factories.user().save()
  })

  beforeEach(async () => {
    notifyCall = null
    mockify(OneSignal, 'notify', spy(opts => {
      notifyCall = opts
    }))

    pushNotification = new PushNotification({
      alert: 'hi',
      path: '/post',
      badge_no: 7,
      platform: 'ios_macos',
      user_id: user.id
    })
    await pushNotification.save()
  })

  after(() => {
    process.env.PUSH_NOTIFICATIONS_ENABLED = tmpEnvVar
    unspyify(OneSignal, 'notify')
  })

  describe('without PUSH_NOTIFICATIONS_ENABLED', () => {
    let user, post, group

    before(() => {
      delete process.env.PUSH_NOTIFICATIONS_ENABLED
    })

    beforeEach(async () => {
      const username = 'username'
      const postname = 'My Post'
      user = await factories.user({ name: username, settings: { locale: 'en' } }).save()
      post = await factories.post({ user_id: user.id, name: postname }).save()
      group = await factories.group({ name: 'Friends of Cheese' }).save()
    })

    it('returns correct text with textForAnnouncement', async () => {
      await post.load('user')
      const person = post.relations.user.get('name')
      const postName = post.get('name')
      const expected = `${person} sent an announcement "${postName}" to ${group.get('name')}`
      expect(PushNotification.textForAnnouncement(post, group, 'en')).to.equal(expected)
    })

    it('sets sent_at and disabled', function () {
      return pushNotification.send()
        .then(() => {
          return pushNotification.fetch()
            .then(pn => {
              expect(pn.get('sent_at')).not.to.equal(null)
              expect(pn.get('disabled')).to.be.true
            })
        })
    })

    describe('with PUSH_NOTIFICATIONS_TESTING_ENABLED', () => {
      let tmpEnvVar2

      before(() => {
        tmpEnvVar2 = process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED
        process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED = 'true'
      })

      after(() => {
        process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED = tmpEnvVar2
      })

      it('sets sent_at and disabled for a non-test device', async () => {
        await pushNotification.send()
        const pn = await pushNotification.fetch()
        expect(pn.get('sent_at')).not.to.equal(null)
        expect(pn.get('disabled')).to.be.true
        expect(OneSignal.notify).not.to.have.been.called()
      })

      it('sends for a test device', async () => {
        const testUser = await factories.user({ tester: true }).save()
        pushNotification.set('user_id', testUser.id)
        await pushNotification.save()
        await pushNotification.send()
        const pn = await pushNotification.fetch()
        expect(pn.get('sent_at')).not.to.equal(null)
        expect(pn.get('disabled')).to.be.false
        expect(OneSignal.notify).to.have.been.called()
      })
    })
  })

  describe('with PUSH_NOTIFICATIONS_ENABLED', () => {
    before(() => {
      process.env.PUSH_NOTIFICATIONS_ENABLED = 'true'
    })

    it('sends push notification', async () => {
      await pushNotification.send()
      const pn = await pushNotification.fetch()

      expect(pn.get('sent_at')).not.to.equal(null)
      expect(pn.get('disabled')).to.be.false
      expect(OneSignal.notify).to.have.been.called()

      expect(notifyCall).to.deep.equal({
        readerId: user.id,
        alert: 'hi',
        path: '/post',
        badgeNo: 7
      })
    })
  })
})
