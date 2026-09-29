/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import personalizeData from '../../../lib/group/digest2/personalizeData'
import { seenContentFor } from '../../../lib/group/digest2/dedupe'
import { sendToUser } from '../../../lib/group/digest2'

const HOUR = 60 * 60 * 1000
const hoursAgo = hours => new Date(Date.now() - hours * HOUR)

describe('digest content', () => {
  let author, group

  before(async () => {
    await setup.clearDb()
    author = await factories.user({ name: 'Post Author' }).save()
    group = await factories.group({ name: 'Garden Club' }).save()
  })

  after(() => setup.clearDb())

  const newRecipient = () => factories.user({ settings: { locale: 'en-US' } }).save()

  const savePost = (attrs = {}) => factories.post({
    user_id: author.id,
    type: 'discussion',
    created_at: hoursAgo(10),
    updated_at: hoursAgo(10),
    ...attrs
  }).save()

  // A post as formatData presents it to the digest
  const presented = (post, extra = {}) => ({
    id: Number(post.id),
    title: post.get('name'),
    type: post.get('type'),
    details: '',
    user: { id: author.id, name: author.get('name'), avatar_url: null },
    comments: [],
    url: `https://www.hylo.com/groups/garden/post/${post.id}`,
    ...extra
  })

  const digest = (sections = {}) => ({
    group_id: group.id,
    group_name: group.get('name'),
    group_url: 'https://www.hylo.com/groups/garden',
    discussions: [],
    requests: [],
    offers: [],
    events: [],
    projects: [],
    resources: [],
    proposals: [],
    chats: [],
    posts_with_new_comments: [],
    ...sections
  })

  // A post notification row, as Activity#createNotifications writes it
  async function notified (reader, post, { medium = Notification.MEDIUM.Email, sent = true, commentId = null } = {}) {
    const [activity] = await bookshelf.knex('activities').insert({
      reader_id: reader.id,
      actor_id: author.id,
      post_id: post.id,
      comment_id: commentId,
      meta: JSON.stringify({ reasons: ['newPost'] }),
      created_at: hoursAgo(9)
    }).returning('id')
    await bookshelf.knex('notifications').insert({
      activity_id: activity.id || activity,
      user_id: reader.id,
      medium,
      created_at: hoursAgo(9),
      sent_at: sent ? hoursAgo(9) : null
    })
  }

  const read = (reader, post, at) => bookshelf.knex('posts_users').insert({
    user_id: reader.id,
    post_id: post.id,
    last_read_at: at,
    created_at: at,
    following: true,
    active: true
  })

  describe('leaving out what the member already has (D39)', () => {
    it('leaves out a post that was already emailed to the member', async () => {
      const recipient = await newRecipient()
      const emailed = await savePost()
      const fresh = await savePost()
      await notified(recipient, emailed)

      const result = await personalizeData(recipient, 'daily', digest({
        discussions: [presented(emailed), presented(fresh)]
      }))

      expect(result.discussions.map(p => p.id)).to.deep.equal([Number(fresh.id)])
    })

    it('keeps a post whose email was never sent, or that only reached them in the app', async () => {
      const recipient = await newRecipient()
      const unsent = await savePost()
      const inApp = await savePost()
      await notified(recipient, unsent, { sent: false })
      await notified(recipient, inApp, { medium: Notification.MEDIUM.InApp })

      const result = await personalizeData(recipient, 'daily', digest({
        requests: [presented(unsent, { type: 'request' }), presented(inApp, { type: 'request' })]
      }))

      expect(result.requests.map(p => p.id).sort()).to.deep.equal([Number(unsent.id), Number(inApp.id)].sort())
    })

    it('does not count an email about a comment as having the post', async () => {
      const recipient = await newRecipient()
      const post = await savePost()
      const comment = await factories.comment({ post_id: post.id, user_id: author.id, created_at: hoursAgo(8) }).save()
      await notified(recipient, post, { commentId: comment.id })

      const result = await personalizeData(recipient, 'daily', digest({ discussions: [presented(post)] }))
      expect(result.discussions.map(p => p.id)).to.deep.equal([Number(post.id)])
    })

    it('leaves out a post the member has already read', async () => {
      const recipient = await newRecipient()
      const opened = await savePost()
      const unopened = await savePost()
      const openedBefore = await savePost({ created_at: hoursAgo(2) })
      await read(recipient, opened, hoursAgo(5))
      // Read an earlier version of the thread than the post itself: not read
      await read(recipient, openedBefore, hoursAgo(3))

      const result = await personalizeData(recipient, 'daily', digest({
        offers: [presented(opened, { type: 'offer' }), presented(unopened, { type: 'offer' }), presented(openedBefore, { type: 'offer' })]
      }))

      expect(result.offers.map(p => p.id).sort()).to.deep.equal([Number(unopened.id), Number(openedBefore.id)].sort())
    })

    it('drops comments older than the member\'s last read of the post, and counts what is left', async () => {
      const recipient = await newRecipient()
      const post = await savePost({ created_at: hoursAgo(30) })
      const seen = await factories.comment({ post_id: post.id, user_id: author.id, created_at: hoursAgo(6) }).save()
      const unseen = await factories.comment({ post_id: post.id, user_id: author.id, created_at: hoursAgo(2) }).save()
      await read(recipient, post, hoursAgo(4))

      const comment = c => ({ id: Number(c.id), text: 'hi', user: { id: author.id, name: 'Post Author' } })
      const result = await personalizeData(recipient, 'daily', digest({
        discussions: [presented(await savePost())],
        posts_with_new_comments: [presented(post, { comments: [comment(seen), comment(unseen)], comment_count: 2 })]
      }))

      expect(result.posts_with_new_comments).to.have.length(1)
      expect(result.posts_with_new_comments[0].comments.map(c => c.id)).to.deep.equal([Number(unseen.id)])
      expect(result.posts_with_new_comments[0].comment_count).to.equal(1)
    })

    it('drops a post with new comments when the member has read all of them', async () => {
      const recipient = await newRecipient()
      const post = await savePost({ created_at: hoursAgo(30) })
      const seen = await factories.comment({ post_id: post.id, user_id: author.id, created_at: hoursAgo(6) }).save()
      await read(recipient, post, hoursAgo(1))

      const result = await personalizeData(recipient, 'daily', digest({
        discussions: [presented(await savePost())],
        posts_with_new_comments: [presented(post, { comments: [{ id: Number(seen.id), text: 'hi', user: { id: author.id } }], comment_count: 1 })]
      }))

      expect(result.posts_with_new_comments).to.deep.equal([])
    })

    it('skips the digest when everything in it was already emailed or read', async () => {
      const recipient = await newRecipient()
      const emailed = await savePost()
      const opened = await savePost()
      await notified(recipient, emailed)
      await read(recipient, opened, hoursAgo(1))

      const data = digest({ discussions: [presented(emailed), presented(opened)] })
      expect(await personalizeData(recipient, 'daily', data)).to.equal(null)

      mockify(Email, 'sendSimpleEmail', () => Promise.resolve(true))
      try {
        expect(await sendToUser(recipient, 'daily', data)).to.equal(false)
        expect(Email.sendSimpleEmail).not.to.have.been.called()
      } finally {
        unspyify(Email, 'sendSimpleEmail')
      }
    })

    it('looks everything up in one query per recipient', async () => {
      const recipient = await newRecipient()
      const emailed = await savePost()
      const opened = await savePost()
      await notified(recipient, emailed)
      await read(recipient, opened, hoursAgo(1))

      const queries = []
      const onQuery = q => queries.push(q.sql)
      bookshelf.knex.on('query', onQuery)
      try {
        const seen = await seenContentFor(recipient.id, { postIds: [String(emailed.id), String(opened.id)], commentIds: [] })
        expect([...seen.emailedPostIds]).to.deep.equal([String(emailed.id)])
        expect([...seen.readPostIds]).to.deep.equal([String(opened.id)])
      } finally {
        bookshelf.knex.removeListener('query', onQuery)
      }
      expect(queries).to.have.length(1)
    })

    it('makes no query when there is nothing to check', async () => {
      const seen = await seenContentFor(1, { postIds: [], commentIds: [] })
      expect(seen.emailedPostIds.size + seen.readPostIds.size + seen.seenCommentIds.size).to.equal(0)
    })
  })
})
