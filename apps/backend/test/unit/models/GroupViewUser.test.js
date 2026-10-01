import RedisClient from '../../../api/services/RedisClient'
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

const model = factories.mock.model

describe('GroupViewUser', () => {
  describe('.chatRoomDisplayName', () => {
    it('returns the group name for a regular group', () => {
      const group = model({ name: 'Foo Group' })
      expect(GroupViewUser.chatRoomDisplayName(group)).to.equal('Foo Group')
    })

    it('returns parent > space for a space', () => {
      const parent = model({ name: 'Foo Group' })
      const space = model({
        name: 'Garden',
        type: 'space',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Foo Group > Garden')
    })

    it('falls back to the space name when the parent is missing', () => {
      const space = model({ name: 'Garden', type: 'space' })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Garden')
    })

    it('ignores an empty related parent model', () => {
      const space = model({
        name: 'Garden',
        type: 'space',
        relations: { parentGroup: model({}) }
      })
      expect(GroupViewUser.chatRoomDisplayName(space)).to.equal('Garden')
    })
  })

  describe('.chatRoomAvatarUrl', () => {
    it('returns the group avatar for a regular group', () => {
      const group = model({ avatar_url: 'https://example.com/group.png' })
      expect(GroupViewUser.chatRoomAvatarUrl(group)).to.equal('https://example.com/group.png')
    })

    it('falls back to the parent group avatar when a space has none', () => {
      const parent = model({ avatar_url: 'https://example.com/group.png' })
      const space = model({
        type: 'space',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomAvatarUrl(space)).to.equal('https://example.com/group.png')
    })

    it('uses the space avatar when it has one', () => {
      const parent = model({ avatar_url: 'https://example.com/group.png' })
      const space = model({
        type: 'space',
        avatar_url: 'https://example.com/space.png',
        relations: { parentGroup: parent }
      })
      expect(GroupViewUser.chatRoomAvatarUrl(space)).to.equal('https://example.com/space.png')
    })
  })

  describe('.sendDigests for a space chat', () => {
    let parent, space, reader, originalEmailNotificationsEnabled

    beforeEach(async () => {
      await setup.clearDb()
      originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
      mockify(Email, 'sendChatDigest', () => Promise.resolve(true))
      await (await RedisClient.create()).del('ChatRoom.digests.lastSentAt')

      parent = await factories.group({ name: 'Parent' }).save()
      space = await factories.group({ name: 'Garden', type: 'space', parent_id: parent.id }).save()
      reader = await factories.user().save()
      const author = await factories.user().save()

      const chat = await GroupView.forge({ group_id: space.id, type: GroupView.Type.CHAT, name: 'Chat', order: 0 }).save()
      const post = await factories.post({ type: Post.Type.CHAT, user_id: author.id }).save()
      await space.posts().attach(post)
      await GroupViewUser.forge({ view_id: chat.id, user_id: reader.id, new_post_count: 1 }).save()
    })

    afterEach(() => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
      unspyify(Email, 'sendChatDigest')
    })

    it('is skipped when the parent group membership has email off', async () => {
      await parent.addMembers([reader.id], { settings: { sendEmail: false, postNotifications: 'all' } })
      await space.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all' } })

      const sent = await GroupViewUser.sendDigests()
      expect(sent).to.equal(0)
      expect(Email.sendChatDigest).not.to.have.been.called()
    })

    it('is sent when the parent group membership has email on', async () => {
      await parent.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all' } })
      await space.addMembers([reader.id], { settings: { sendEmail: false, postNotifications: 'all' } })

      const sent = await GroupViewUser.sendDigests()
      expect(sent).to.equal(1)
      expect(Email.sendChatDigest).to.have.been.called.exactly(1)
    })

    it("falls back to the space membership's setting without a parent membership", async () => {
      await space.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all' } })

      const sent = await GroupViewUser.sendDigests()
      expect(sent).to.equal(1)
    })

    it("is skipped when the parent group's email digest is Never", async () => {
      await parent.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all', digestFrequency: 'never' } })
      await space.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all', digestFrequency: 'daily' } })

      const sent = await GroupViewUser.sendDigests()
      expect(sent).to.equal(0)
      expect(Email.sendChatDigest).not.to.have.been.called()
    })
  })

  describe('.sendDigests and the email digest setting', () => {
    let group, reader, originalEmailNotificationsEnabled

    beforeEach(async () => {
      await setup.clearDb()
      originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
      mockify(Email, 'sendChatDigest', () => Promise.resolve(true))
      await (await RedisClient.create()).del('ChatRoom.digests.lastSentAt')

      group = await factories.group({ name: 'Orchard' }).save()
      reader = await factories.user().save()
      const author = await factories.user().save()

      const chat = await GroupView.forge({ group_id: group.id, type: GroupView.Type.CHAT, name: 'Chat', order: 0 }).save()
      const post = await factories.post({ type: Post.Type.CHAT, user_id: author.id }).save()
      await group.posts().attach(post)
      await GroupViewUser.forge({ view_id: chat.id, user_id: reader.id, new_post_count: 1 }).save()
    })

    afterEach(() => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
      unspyify(Email, 'sendChatDigest')
    })

    it('sends no chat digest when the email digest is Never', async () => {
      await group.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all', digestFrequency: 'never' } })

      expect(await GroupViewUser.sendDigests()).to.equal(0)
      expect(Email.sendChatDigest).not.to.have.been.called()
    })

    for (const digestFrequency of ['daily', 'weekly']) {
      it(`still sends the chat digest when the email digest is ${digestFrequency}`, async () => {
        await group.addMembers([reader.id], { settings: { sendEmail: true, postNotifications: 'all', digestFrequency } })

        expect(await GroupViewUser.sendDigests()).to.equal(1)
      })
    }
  })
})
