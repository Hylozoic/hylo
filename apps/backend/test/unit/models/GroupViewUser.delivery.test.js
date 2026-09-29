// Who gets the hourly chat digest: the emailed settings page's unsubscribe choices (D35)
import RedisClient from '../../../api/services/RedisClient'
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

describe('GroupViewUser.sendDigests delivery', () => {
  let group, reader, author, chat, sends, originalEmailNotificationsEnabled

  const mention = user => `<p>hi <span class="mention" data-type="mention" data-id="${user.id}" data-label="${user.get('name')}">${user.get('name')}</span></p>`

  const addChat = async (description = '<p>hello</p>') => {
    const post = await factories.post({ type: Post.Type.CHAT, user_id: author.id, description }).save()
    await group.posts().attach(post)
    return post
  }

  beforeEach(async () => {
    await setup.clearDb()
    originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    sends = []
    mockify(Email, 'sendChatDigest', opts => { sends.push(opts); return Promise.resolve(true) })
    await (await RedisClient.create()).del('ChatRoom.digests.lastSentAt')

    group = await factories.group({ name: 'Orchard' }).save()
    reader = await factories.user({ last_active_at: new Date() }).save()
    author = await factories.user().save()
    chat = await GroupView.forge({ group_id: group.id, type: GroupView.Type.CHAT, name: 'Chat', order: 0 }).save()
    await GroupViewUser.forge({ view_id: chat.id, user_id: reader.id, new_post_count: 1 }).save()
    await group.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all', digestFrequency: 'daily' } })
  })

  afterEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
    unspyify(Email, 'sendChatDigest')
  })

  describe('unsubscribe choices', () => {
    it("'everything except direct' sends only chats that mention the reader", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)
      await addChat()
      const mentioning = await addChat(mention(reader))

      expect(await GroupViewUser.sendDigests()).to.equal(1)
      expect(sends[0].data.posts.map(p => p.id)).to.deep.equal([mentioning.id])
    })

    it("'everything except direct' sends nothing without a mention", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)
      await addChat()

      expect(await GroupViewUser.sendDigests()).to.equal(0)
    })

    it("'everything' sends nothing, mentions included", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'everything' }, true)
      await addChat(mention(reader))

      expect(await GroupViewUser.sendDigests()).to.equal(0)
    })

    it("'digest only' keeps every chat", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'digest_only' }, true)
      await addChat()
      await addChat()

      expect(await GroupViewUser.sendDigests()).to.equal(1)
      expect(sends[0].data.posts).to.have.length(2)
    })
  })
})
