/* eslint-disable no-unused-expressions */
// What a notification email's one-click unsubscribe switches off (D34), and which of
// them still reach someone who chose "everything except direct" (D35, D7)
import nock from 'nock'
import '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { readUnsubscribeToken } from '../../../lib/email/unsubscribeToken'

const SENDWITHUS_SEND_PATH = '/api/v1_0/send'

const relations = [
  'activity',
  'activity.post',
  'activity.post.user',
  'activity.post.groups',
  'activity.group',
  'activity.reader',
  'activity.actor'
]

describe('Notification emails and unsubscribing', () => {
  let actor, reader, group, post, originalEmailNotificationsEnabled

  const notificationFor = async (reasons, medium = Notification.MEDIUM.Email) => {
    const activity = await new Activity({
      post_id: post.id,
      meta: { reasons },
      reader_id: reader.id,
      actor_id: actor.id,
      group_id: group.id
    }).save()
    const notification = await new Notification({ activity_id: activity.id, medium }).save()
    return notification.load(relations)
  }

  // The options the notification passed to this Email sender
  const optsSentBy = async (sender, reasons) => {
    let sent = null
    mockify(Email, sender, opts => { sent = opts; return Promise.resolve({ success: true }) })
    try {
      await (await notificationFor(reasons)).send()
    } finally {
      unspyify(Email, sender)
    }
    return sent
  }

  before(async () => {
    actor = await factories.user({ name: 'Poster' }).save()
    reader = await factories.user().save()
    group = await factories.group().save()
    post = await factories.post({ user_id: actor.id, type: 'event' }).save()
    await group.posts().attach(post)
    await group.addMembers([actor.id, reader.id], { settings: { sendEmail: true, sendPushNotifications: true } })
  })

  beforeEach(() => {
    originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
  })

  afterEach(async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
    nock.cleanAll()
    await reader.removeSetting('email_unsubscribe_scope', true)
  })

  describe('the group a one-click applies to', () => {
    it('a new post email names its group', async () => {
      const opts = await optsSentBy('sendPostNotification', [`newPost: ${group.id}`])
      expect(opts.unsubscribe).to.deep.equal({ groupId: group.id })
    })

    it('an announcement email names its group', async () => {
      const opts = await optsSentBy('sendPostNotification', ['announcement'])
      expect(opts.data.announcement).to.be.true
      expect(opts.unsubscribe).to.deep.equal({ groupId: group.id })
    })

    it('an event invitation email names its group', async () => {
      const opts = await optsSentBy('sendEventInvitationEmail', ['eventInvitation'])
      expect(String(opts.unsubscribe.groupId)).to.equal(String(group.id))
    })

    it('an announcement that mentions the reader is direct and links to the settings page', async () => {
      const opts = await optsSentBy('sendPostNotification', ['announcement', 'mention'])
      expect(opts.unsubscribe).to.deep.equal({ groupId: group.id, direct: true, descriptor: 'settings_page' })
    })
  })

  describe("for someone who chose 'everything except direct'", () => {
    let sends, sentBody

    beforeEach(async () => {
      sends = 0
      sentBody = null
      await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)
      nock('https://api.sendwithus.com')
        .post(SENDWITHUS_SEND_PATH, body => { sends += 1; sentBody = body; return true })
        .reply(200, { success: true })
    })

    it('still sends an announcement that mentions them, without a one-click', async () => {
      const notification = await notificationFor(['announcement', 'mention'])
      await notification.send()

      expect(sends).to.equal(1)
      expect(sentBody.recipient.address).to.equal(reader.get('email'))
      expect(sentBody.headers).not.to.have.property('List-Unsubscribe-Post')
      const token = readUnsubscribeToken(decodeURIComponent(sentBody.headers['List-Unsubscribe'].match(/token=([^>&]+)/)[1]))
      expect(token.descriptor).to.equal('settings_page')
    })

    it('skips an announcement that does not mention them, and marks it sent', async () => {
      const notification = await notificationFor(['announcement'])
      await notification.send()

      expect(sends).to.equal(0)
      expect((await Notification.find(notification.id)).get('sent_at')).not.to.equal(null)
    })
  })
})
