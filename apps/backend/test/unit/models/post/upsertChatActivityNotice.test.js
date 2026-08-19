/* eslint-disable no-unused-expressions */
import upsertChatActivityNotice, { chatActivityBucketKey, findChatActivityNoticeForPost } from '../../../../api/models/post/upsertChatActivityNotice'
const rootPath = require('root-path')
const setup = require(rootPath('test/setup'))
const factories = require(rootPath('test/setup/factories'))

describe('chatActivityBucketKey', () => {
  it('builds a UTC hour bucket key', () => {
    expect(chatActivityBucketKey(1234, new Date('2026-08-06T17:40:00.000Z'))).to.equal('1234:2026-08-06T17')
  })
})

describe('upsertChatActivityNotice', function () {
  let author, group, axolotl

  before(async function () {
    const hasColumn = await bookshelf.knex.schema.hasColumn('posts', 'notice_data')
    if (!hasColumn) this.skip()
  })

  beforeEach(async () => {
    await setup.clearDb()
    axolotl = await User.where({ id: User.AXOLOTL_ID }).fetch()
    if (!axolotl) {
      axolotl = await factories.user({
        id: User.AXOLOTL_ID,
        name: 'Axolotl',
        email: 'axolotl-notice-test@hylo.com',
        active: true
      }).save(null, { method: 'insert' })
    }
    author = await factories.user().save()
    group = await factories.group().save()
  })

  async function createChat (attrs = {}) {
    const createdAt = attrs.created_at || new Date()
    const post = await factories.post({
      type: Post.Type.CHAT,
      user_id: author.id,
      description: 'hello chat',
      ...attrs
    }).save()
    await post.groups().attach(group.id)
    await bookshelf.knex('posts').where({ id: post.id }).update({
      created_at: createdAt,
      updated_at: attrs.updated_at || createdAt
    })
    await post.refresh()
    return post
  }

  it('creates one notice per group per hour and updates it for later chats', async () => {
    const hour = new Date(Date.UTC(2026, 7, 6, 17, 10, 0))
    const later = new Date(Date.UTC(2026, 7, 6, 17, 40, 0))

    const first = await createChat({ created_at: hour, updated_at: hour })
    await upsertChatActivityNotice({ postId: first.id })

    const second = await createChat({ created_at: later, updated_at: later })
    await upsertChatActivityNotice({ postId: second.id })

    const notices = await Post.query(q => {
      q.where('posts.type', Post.Type.CHAT_ACTIVITY)
      q.where('posts.active', true)
    }).fetchAll()
    expect(notices.length).to.equal(1)

    const notice = notices.first()
    const data = notice.get('notice_data')
    expect(data.bucketKey).to.equal(chatActivityBucketKey(group.id, hour))
    expect(data.postCount).to.equal(2)
    expect(data.recentPostIds.map(String)).to.deep.equal([String(second.id), String(first.id)])
    expect(new Date(notice.get('created_at')).getTime()).to.equal(later.getTime())
    expect(new Date(notice.get('updated_at')).getTime()).to.equal(later.getTime())
    expect(String(notice.get('user_id'))).to.equal(String(axolotl.id))
  })

  it('creates a separate notice for a different hour', async () => {
    const firstHour = new Date(Date.UTC(2026, 7, 6, 17, 10, 0))
    const nextHour = new Date(Date.UTC(2026, 7, 6, 18, 5, 0))

    const first = await createChat({ created_at: firstHour, updated_at: firstHour })
    await upsertChatActivityNotice({ postId: first.id })
    const second = await createChat({ created_at: nextHour, updated_at: nextHour })
    await upsertChatActivityNotice({ postId: second.id })

    const notices = await Post.query(q => {
      q.where('posts.type', Post.Type.CHAT_ACTIVITY)
      q.where('posts.active', true)
    }).fetchAll()
    expect(notices.length).to.equal(2)
  })

  it('deactivates the notice when the last chat in the hour is removed', async () => {
    const hour = new Date(Date.UTC(2026, 7, 6, 17, 10, 0))
    const chat = await createChat({ created_at: hour, updated_at: hour })
    await upsertChatActivityNotice({ postId: chat.id })

    await chat.save({ active: false, deactivated_at: new Date() }, { patch: true })
    await upsertChatActivityNotice({ postId: chat.id })

    const notice = await Post.query(q => {
      q.whereRaw("posts.notice_data->>'bucketKey' = ?", [chatActivityBucketKey(group.id, hour)])
    }).fetch({ require: false })
    expect(notice.get('active')).to.equal(false)
  })

  it('finds the notice for a chat after upsert', async () => {
    const hour = new Date(Date.UTC(2026, 7, 6, 17, 10, 0))
    const chat = await createChat({ created_at: hour, updated_at: hour })
    await upsertChatActivityNotice({ postId: chat.id })

    const notice = await findChatActivityNoticeForPost(chat)
    expect(notice).to.exist
    expect(notice.get('type')).to.equal(Post.Type.CHAT_ACTIVITY)
    expect(notice.get('notice_data').recentPostIds.map(String)).to.include(String(chat.id))
  })
})
