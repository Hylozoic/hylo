// Comment and message digests under the emailed settings page's unsubscribe choices (D35),
// and for members away 180 days or more (D9)
import { times } from 'lodash'
import RedisClient from '../../../../api/services/RedisClient'
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'

describe('comment digests and unsubscribe choices', () => {
  let author, reader, post, comments, log, now, group
  let originalEmailNotificationsEnabled

  const mention = user => `hello <a class="mention" data-id="${user.id}" data-label="buddy">buddy</a>!`
  const sentTo = user => log.find(l => l.email === user.get('email'))

  beforeEach(async () => {
    originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    now = new Date()
    log = []
    comments = []

    author = factories.user({ settings: { dm_notifications: 'both', comment_notifications: 'email' } })
    reader = factories.user({ settings: { dm_notifications: 'both', comment_notifications: 'email' } })
    group = factories.group()
    post = factories.post({ updated_at: now })

    await Promise.all([group.save(), author.save(), reader.save()])
    await post.save({ user_id: author.id })
    await post.addFollowers([author.id, reader.id])
    await group.posts().attach(post)
    await group.addMembers([author.id, reader.id], { settings: { sendEmail: true } })
    // comments[0..2] by the author, comments[3] by the reader
    times(3, i => comments.push(factories.comment({
      post_id: post.id, user_id: author.id, created_at: new Date(now - (6 - i) * 60000)
    })))
    comments.push(factories.comment({ post_id: post.id, user_id: reader.id, created_at: new Date(now - 7 * 60000) }))
    await Promise.all(comments.map(c => c.save()))
    await (await RedisClient.create()).del(Comment.sendDigests.REDIS_TIMESTAMP_KEY)

    mockify(Email, 'sendCommentDigest', args => log.push(args))
    mockify(Email, 'sendMessageDigest', args => log.push(args))
  })

  afterEach(async () => {
    unspyify(Email, 'sendCommentDigest')
    unspyify(Email, 'sendMessageDigest')
    process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
    await setup.clearDb()
  })

  it("'everything except direct' keeps only comments that mention the reader", async () => {
    await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)
    await comments[1].save({ text: mention(reader) }, { patch: true })

    await Comment.sendDigests()

    expect(sentTo(reader).data.comments.map(c => c.id)).to.deep.equal([comments[1].id])
  })

  it("'everything except direct' still sends the post's author every comment on it", async () => {
    await author.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)
    await comments[3].save({ created_at: new Date(now - 60000) }, { patch: true })

    await Comment.sendDigests()

    expect(sentTo(author).data.comments.map(c => c.id)).to.deep.equal([comments[3].id])
  })

  it("'everything except direct' sends nothing when no comment speaks to the reader", async () => {
    await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)

    await Comment.sendDigests()

    expect(sentTo(reader)).not.to.exist
  })

  it("'digest only' keeps comment digests", async () => {
    await reader.addSetting({ email_unsubscribe_scope: 'digest_only' }, true)

    await Comment.sendDigests()

    expect(sentTo(reader).data.comments).to.have.length(3)
  })

  it("'everything' stops comment digests, mentions included", async () => {
    await reader.addSetting({ email_unsubscribe_scope: 'everything' }, true)
    await comments[1].save({ text: mention(reader) }, { patch: true })

    await Comment.sendDigests()

    expect(sentTo(reader)).not.to.exist
  })

  describe('what its one-click unsubscribe switches off (D34)', () => {
    it('a comment digest turns comment email off, its sender line in emailTypes', async () => {
      await Comment.sendDigests()

      expect(sentTo(reader).data.comments).to.have.length(3)
      expect(sentTo(reader).unsubscribe).to.equal(undefined)
    })

    it('a digest of only mentions, sent with comment email off, links to the settings page', async () => {
      await reader.addSetting({ comment_notifications: 'push' }, true)
      await comments[1].save({ text: mention(reader) }, { patch: true })

      await Comment.sendDigests()

      expect(sentTo(reader).data.comments.map(c => c.id)).to.deep.equal([comments[1].id])
      expect(sentTo(reader).unsubscribe).to.deep.equal({ descriptor: 'settings_page' })
    })
  })

  describe('members who are away (D9)', () => {
    const DAY = 24 * 60 * 60 * 1000

    it('after 180 days, keeps only comments that mention them', async () => {
      await reader.save({ last_active_at: new Date(Date.now() - 200 * DAY) }, { patch: true })
      await comments[1].save({ text: mention(reader) }, { patch: true })

      await Comment.sendDigests()

      expect(sentTo(reader).data.comments.map(c => c.id)).to.deep.equal([comments[1].id])
    })

    it('after 180 days, still sends the post author comments on their post', async () => {
      await author.save({ last_active_at: new Date(Date.now() - 200 * DAY) }, { patch: true })

      await Comment.sendDigests()

      expect(sentTo(author).data.comments.map(c => c.id)).to.deep.equal([comments[3].id])
    })

    it('between 30 and 180 days, comment digests are unchanged', async () => {
      await reader.save({ last_active_at: new Date(Date.now() - 90 * DAY) }, { patch: true })

      await Comment.sendDigests()

      expect(sentTo(reader).data.comments).to.have.length(3)
    })

    it('after 180 days, direct messages still arrive', async () => {
      await post.save({ type: Post.Type.THREAD }, { patch: true })
      await reader.save({ last_active_at: new Date(Date.now() - 200 * DAY) }, { patch: true })

      await Comment.sendDigests()

      expect(sentTo(reader).data.messages).to.have.length(3)
    })
  })

  describe('in a message thread', () => {
    beforeEach(() => post.save({ type: Post.Type.THREAD }, { patch: true }))

    it("'everything except direct' still sends direct messages", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'all_but_direct' }, true)

      await Comment.sendDigests()

      expect(sentTo(reader).data.messages).to.have.length(3)
    })

    it("'everything' stops them", async () => {
      await reader.addSetting({ email_unsubscribe_scope: 'everything' }, true)

      await Comment.sendDigests()

      expect(sentTo(reader)).not.to.exist
    })
  })
})
