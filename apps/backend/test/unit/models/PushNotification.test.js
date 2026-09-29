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
    let user, post, group, testerIds

    // In a fresh database the first user is id 1, which test setup lists as a tester
    before(() => {
      delete process.env.PUSH_NOTIFICATIONS_ENABLED
      testerIds = process.env.HYLO_TESTER_IDS
      process.env.HYLO_TESTER_IDS = ''
    })

    after(() => {
      process.env.HYLO_TESTER_IDS = testerIds
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
      const expected = `Announcement from ${person}: ${postName}`
      expect(PushNotification.textForAnnouncement(post, group, 'en')).to.equal(expected)
    })

    it("uses 'Name: first line' for a post, leaving the group name to the heading", async () => {
      const chat = await factories.post({ user_id: user.id, name: null, description: '<p>First line</p><p>Second line</p>' }).save()
      await chat.load('user')
      expect(PushNotification.textForPost(chat, group, null, 'chat', 'en')).to.equal('username: First line')
      expect(PushNotification.textForPost(chat, group, null, 'mention', 'en')).to.equal('username mentioned you: First line')
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

    // describe('with PUSH_NOTIFICATIONS_TESTING_ENABLED', () => {
    //   let tmpEnvVar2

    //   before(() => {
    //     tmpEnvVar2 = process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED
    //     process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED = 'true'
    //   })

    //   after(() => {
    //     process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED = tmpEnvVar2
    //   })

    //   it('sets sent_at and disabled for a non-test device', async () => {
    //     await pushNotification.send()
    //     const pn = await pushNotification.fetch()
    //     expect(pn.get('sent_at')).not.to.equal(null)
    //     expect(pn.get('disabled')).to.be.true
    //     expect(OneSignal.notify).not.to.have.been.called()
    //   })

    //   it('sends for a test device', async () => {
    //     const testUser = await factories.user({ tester: true }).save()
    //     pushNotification.set('user_id', testUser.id)
    //     await pushNotification.save()
    //     await pushNotification.send()
    //     const pn = await pushNotification.fetch()
    //     expect(pn.get('sent_at')).not.to.equal(null)
    //     expect(pn.get('disabled')).to.be.false
    //     expect(OneSignal.notify).to.have.been.called()
    //   })
    // })
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

    it('passes the heading, tray group and collapse key through without storing them', async () => {
      await pushNotification.send(undefined, { heading: 'Garden', groupKey: 'group-4', collapseKey: 'chat-9' })

      expect(notifyCall).to.deep.equal({
        readerId: user.id,
        alert: 'hi',
        path: '/post',
        badgeNo: 7,
        heading: 'Garden',
        groupKey: 'group-4',
        collapseKey: 'chat-9'
      })
      const pn = await pushNotification.fetch()
      expect(Object.keys(pn.attributes)).not.to.include('heading')
    })

    it('leaves sent_at empty and resolves false when OneSignal fails', async () => {
      mockify(OneSignal, 'notify', spy(() => Promise.resolve(false)))

      const result = await pushNotification.send()
      const pn = await pushNotification.fetch()

      expect(result).to.equal(false)
      expect(OneSignal.notify).to.have.been.called()
      expect(pn.get('sent_at')).to.equal(null)
    })
  })

  describe('OneSignal.notify', () => {
    beforeEach(() => unspyify(OneSignal, 'notify'))

    it('resolves false when the notification cannot be sent', async () => {
      const result = await OneSignal.notify({ alert: 'hi', path: '/post' })
      expect(result).to.equal(false)
    })
  })

  describe('pushGrouping', () => {
    const { chatCollapseKeyFor, firstLine, groupKeyFor, pushGroupingFor } = require('../../../api/models/notification/pushGrouping')
    const model = attrs => ({ id: attrs.id, get: key => attrs[key] })

    it('stacks a group by its own id and a space with its parent group', () => {
      expect(groupKeyFor(model({ id: '4', name: 'Garden' }))).to.equal('group-4')
      expect(groupKeyFor(model({ id: '9', name: 'Seeds', type: 'space', parent_id: '4' }))).to.equal('group-4')
    })

    it('collapses a chat room by the room, the same key every time', () => {
      const space = model({ id: '9', name: 'Seeds', type: 'space', parent_id: '4' })
      expect(chatCollapseKeyFor(space)).to.equal('chat-9')
      expect(chatCollapseKeyFor(space)).to.equal(chatCollapseKeyFor(model({ id: '9' })))
    })

    it('only collapses when asked, and gives nothing without a group', () => {
      const group = model({ id: '4', name: 'Garden' })
      expect(pushGroupingFor(group)).to.deep.equal({ heading: 'Garden', groupKey: 'group-4', collapseKey: null })
      expect(pushGroupingFor(group, { collapse: true }).collapseKey).to.equal('chat-4')
      expect(pushGroupingFor(null)).to.deep.equal({})
    })

    it('takes the first non-empty line and shortens a long one', () => {
      expect(firstLine('\n  Hello there \nSecond')).to.equal('Hello there')
      expect(firstLine('x'.repeat(200), 10)).to.equal('xxxxxxxxx…')
    })
  })
})
