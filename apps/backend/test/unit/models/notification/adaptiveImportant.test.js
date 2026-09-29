/* eslint-disable no-unused-expressions */
import { mapValues } from 'lodash'
import setup from '../../../setup'
import factories from '../../../setup/factories'
import {
  conversationParticipants,
  conversationWindowMinutes
} from '../../../../api/models/notification/rules/adaptiveImportant'

const { model } = factories.mock

const makeGettable = obj => Object.assign({ get: key => obj[key], load: () => {} }, obj)
const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60000)
const minutesAgo = (minutes, from = new Date()) => new Date(from.getTime() - minutes * 60000)

function mockReader (memberships, attrs = {}) {
  return {
    get: key => attrs[key],
    getSetting: () => undefined,
    memberships: () => ({
      fetch: () => Promise.resolve({
        models: memberships.map(({ settings, group }) => {
          const membership = GroupMembership.forge({ settings })
          membership.relations = mapValues({ group }, makeGettable)
          return membership
        })
      })
    })
  }
}

const activityFor = ({ reasons, meta = {}, settings, group = { id: 1 }, reader = {} }) => model({
  meta: { reasons, ...meta },
  post_id: 1,
  relations: {
    post: { relations: { groups: [{ id: group.id }] } },
    reader: mockReader([{ settings, group }], reader)
  }
})

const MEDIUM_NAMES = () => ({
  [Notification.MEDIUM.Email]: 'email',
  [Notification.MEDIUM.Push]: 'push',
  [Notification.MEDIUM.InApp]: 'inApp'
})
const mediaFor = async activity => {
  const names = MEDIUM_NAMES()
  return (await Activity.generateNotificationMedia(activity)).map(m => names[m])
}

describe('adaptive Important', () => {
  let originalEmail, originalPush
  beforeEach(() => {
    originalEmail = process.env.EMAIL_NOTIFICATIONS_ENABLED
    originalPush = process.env.PUSH_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    process.env.PUSH_NOTIFICATIONS_ENABLED = 'true'
  })
  afterEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmail
    process.env.PUSH_NOTIFICATIONS_ENABLED = originalPush
  })

  describe('conversationWindowMinutes', () => {
    it('defaults to 20 minutes', () => {
      expect(conversationWindowMinutes({})).to.equal(20)
    })

    it('honours an override inside 5 to 20 minutes', () => {
      expect(conversationWindowMinutes({ NOTIFICATION_CONVERSATION_WINDOW_MINUTES: '10' })).to.equal(10)
    })

    it('clamps an override below 5 minutes up to 5', () => {
      expect(conversationWindowMinutes({ NOTIFICATION_CONVERSATION_WINDOW_MINUTES: '3' })).to.equal(5)
    })

    it('clamps an override above 20 minutes down to 20', () => {
      expect(conversationWindowMinutes({ NOTIFICATION_CONVERSATION_WINDOW_MINUTES: '30' })).to.equal(20)
    })

    it('ignores an override that is not a number', () => {
      expect(conversationWindowMinutes({ NOTIFICATION_CONVERSATION_WINDOW_MINUTES: 'soon' })).to.equal(20)
    })
  })

  describe('conversationParticipants', () => {
    let author, reader, other, room, now

    const chatIn = async (userId, createdAt) => {
      const chat = await factories.post({ user_id: userId, type: Post.Type.CHAT, created_at: createdAt }).save()
      await chat.groups().attach(room.id)
      return chat
    }

    const participantsFor = async chat => (await conversationParticipants({
      postId: chat.id,
      authorId: author.id,
      groupIds: [room.id],
      createdAt: chat.get('created_at')
    })).map(p => p.userId)

    beforeEach(async () => {
      await setup.clearDb()
      author = await factories.user().save()
      reader = await factories.user().save()
      other = await factories.user().save()
      room = await factories.group().save()
      now = new Date()
    })

    it('includes a reader whose last chat was 19 minutes before', async () => {
      await chatIn(reader.id, minutesAgo(19, now))
      const chat = await chatIn(author.id, now)
      expect(await participantsFor(chat)).to.deep.equal([String(reader.id)])
    })

    it('leaves out a reader whose last chat was 21 minutes before', async () => {
      await chatIn(reader.id, minutesAgo(21, now))
      const chat = await chatIn(author.id, now)
      expect(await participantsFor(chat)).to.deep.equal([])
    })

    it('restarts the window with each message the reader sends', async () => {
      await chatIn(reader.id, minutesAgo(45, now))
      await chatIn(reader.id, minutesAgo(4, now))
      const chat = await chatIn(author.id, now)
      expect(await participantsFor(chat)).to.deep.equal([String(reader.id)])
    })

    it("does not extend a reader's window with other people's messages", async () => {
      await chatIn(reader.id, minutesAgo(25, now))
      await chatIn(other.id, minutesAgo(2, now))
      const chat = await chatIn(author.id, now)
      expect(await participantsFor(chat)).to.deep.equal([String(other.id)])
    })

    it("leaves out the author and other rooms' chats", async () => {
      const elsewhere = await factories.group().save()
      const chat = await factories.post({ user_id: reader.id, type: Post.Type.CHAT, created_at: minutesAgo(3, now) }).save()
      await chat.groups().attach(elsewhere.id)
      await chatIn(author.id, minutesAgo(2, now))
      const newChat = await chatIn(author.id, now)
      expect(await participantsFor(newChat)).to.deep.equal([])
    })

    it('honours a shorter window', async () => {
      await chatIn(reader.id, minutesAgo(8, now))
      const chat = await chatIn(author.id, now)
      const ids = (await conversationParticipants({
        postId: chat.id, authorId: author.id, groupIds: [room.id], createdAt: now, minutes: 5
      })).map(p => p.userId)
      expect(ids).to.deep.equal([])
    })
  })

  describe('conversation window in the gate', () => {
    const toggles = { sendEmail: true, sendPushNotifications: true }

    it('delivers a marked chat to a reader on Important by push and in-app, not email', async () => {
      const activity = activityFor({
        reasons: ['chat'],
        meta: { inConversation: true },
        settings: { ...toggles, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal(['push', 'inApp'])
    })

    it('leaves an unmarked chat out for a reader on Important', async () => {
      const activity = activityFor({ reasons: ['chat'], settings: { ...toggles, postNotifications: 'important' } })
      expect(await mediaFor(activity)).to.deep.equal([])
    })

    it('leaves a marked chat out for a reader on No Posts', async () => {
      const activity = activityFor({
        reasons: ['chat'],
        meta: { inConversation: true },
        settings: { ...toggles, postNotifications: 'none' }
      })
      expect(await mediaFor(activity)).to.deep.equal([])
    })
  })

  describe('quiet groups in the gate', () => {
    const quiet = { id: 1, settings: { below_activity_benchmark: true } }
    const busy = { id: 1, settings: { below_activity_benchmark: false } }
    const active = { last_active_at: daysAgo(2) }

    it('delivers every new post in a quiet group to an active reader on Important, on their switches', async () => {
      const activity = activityFor({
        reasons: ['newPost: 1'],
        group: quiet,
        reader: active,
        settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal(['email', 'push', 'inApp'])
    })

    it('follows the email switch in a quiet group', async () => {
      const activity = activityFor({
        reasons: ['newPost: 1'],
        group: quiet,
        reader: active,
        settings: { sendEmail: false, sendPushNotifications: true, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal(['push', 'inApp'])
    })

    it('leaves ordinary posts out in a busy group', async () => {
      const activity = activityFor({
        reasons: ['newPost: 1'],
        group: busy,
        reader: active,
        settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal([])
    })

    it('leaves readers on No Posts unaffected', async () => {
      const activity = activityFor({
        reasons: ['newPost: 1'],
        group: quiet,
        reader: active,
        settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      })
      expect(await mediaFor(activity)).to.deep.equal([])
    })

    it('leaves out readers not active in the last 30 days', async () => {
      const activity = activityFor({
        reasons: ['newPost: 1'],
        group: quiet,
        reader: { last_active_at: daysAgo(40) },
        settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal([])
    })

    it('does not make every chat important in a quiet group', async () => {
      const activity = activityFor({
        reasons: ['chat'],
        group: quiet,
        reader: active,
        settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'important' }
      })
      expect(await mediaFor(activity)).to.deep.equal([])
    })
  })
})
