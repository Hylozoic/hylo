/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'
import {
  NUDGE_REASON,
  postsToNudge,
  sendOpenRequestNudges
} from '../../../../api/models/post/openRequestNudge'
import { answerOpenRequestNudge } from '../../../../api/graphql/mutations/openRequestNudge'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY)

describe('open request nudge (D58)', () => {
  let author, other, group, closedGroup

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    other = await factories.user().save()
    group = await factories.group().save()
    closedGroup = await factories.group({ active: false }).save()
    await group.addMembers([author.id, other.id])
  })

  after(() => setup.clearDb())

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex('comments').del()
    await bookshelf.knex('groups_posts').del()
    await bookshelf.knex('posts').del()
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  async function savePost (attrs = {}, { inGroup = group } = {}) {
    const post = await factories.post({
      user_id: author.id,
      type: 'request',
      created_at: daysAgo(3.2),
      updated_at: daysAgo(3.2),
      ...attrs
    }).save()
    if (inGroup) await bookshelf.knex('groups_posts').insert({ group_id: inGroup.id, post_id: post.id })
    return post
  }

  const nudgesFor = postId => bookshelf.knex('activities')
    .where({ post_id: postId })
    .whereRaw('meta -> \'reasons\' @> ?::jsonb', [JSON.stringify([NUDGE_REASON])])

  it('nudges the author once, about three days after posting, only while nobody has commented', async () => {
    const request = await savePost()
    const offer = await savePost({ type: 'offer' })
    const commented = await savePost()
    await factories.comment({ post_id: commented.id, user_id: other.id, created_at: daysAgo(2) }).save()

    expect(await sendOpenRequestNudges()).to.equal(2)

    const requestNudges = await nudgesFor(request.id)
    expect(requestNudges).to.have.length(1)
    expect(String(requestNudges[0].reader_id)).to.equal(String(author.id))
    expect(await nudgesFor(offer.id)).to.have.length(1)
    expect(await nudgesFor(commented.id)).to.have.length(0)

    // The next day's run finds nothing new
    expect(await sendOpenRequestNudges(new Date(Date.now() + DAY))).to.equal(0)
    expect(await nudgesFor(request.id)).to.have.length(1)
  })

  it('leaves out posts that are too new or too old, met, closed, ended, the wrong type or not in an active group', async () => {
    await savePost({ created_at: daysAgo(1) })
    await savePost({ created_at: daysAgo(9) })
    await savePost({ fulfilled_at: daysAgo(1) })
    await savePost({ active: false })
    await savePost({ end_time: daysAgo(1) })
    await savePost({ type: 'discussion' })
    await savePost({}, { inGroup: closedGroup })
    await savePost({}, { inGroup: null })
    const hiddenComment = await savePost()
    await factories.comment({ post_id: hiddenComment.id, user_id: other.id, active: false }).save()

    const due = await postsToNudge()
    expect(due.map(p => String(p.id))).to.deep.equal([String(hiddenComment.id)])
  })

  it('still nudges a post the daily job missed by a day', async () => {
    const late = await savePost({ created_at: daysAgo(4.5) })
    const due = await postsToNudge()
    expect(due.map(p => String(p.id))).to.deep.equal([String(late.id)])
  })

  it('sends each post its own notification, in the app and by push but never by email', async () => {
    const first = await savePost()
    const second = await savePost()
    await sendOpenRequestNudges()

    for (const post of [first, second]) {
      const [activity] = await nudgesFor(post.id)
      const media = await bookshelf.knex('notifications').where({ activity_id: activity.id }).pluck('medium')
      expect(media.sort()).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push].sort())
    }
  })

  describe('answerOpenRequestNudge', () => {
    it('records "still needed" on the nudge and keeps the post open', async () => {
      const post = await savePost()
      await sendOpenRequestNudges()

      expect(await answerOpenRequestNudge(author.id, { postId: post.id, answer: 'still_needed' })).to.deep.equal({ success: true })

      const [activity] = await nudgesFor(post.id)
      expect(activity.meta.answer).to.equal('still_needed')
      expect(activity.meta.answeredAt).to.be.a('string')
      await post.refresh()
      expect(post.get('fulfilled_at')).to.equal(null)
    })

    it('records "met" after the post was fulfilled', async () => {
      const post = await savePost()
      await sendOpenRequestNudges()
      await post.fulfill()
      await answerOpenRequestNudge(author.id, { postId: post.id, answer: 'met' })
      const [activity] = await nudgesFor(post.id)
      expect(activity.meta.answer).to.equal('met')
    })

    it('succeeds without a nudge to record on, as from a digest link', async () => {
      const post = await savePost({ created_at: daysAgo(12) })
      expect(await answerOpenRequestNudge(author.id, { postId: post.id, answer: 'still_needed' })).to.deep.equal({ success: true })
    })

    it('keeps an answer given from the digest before the nudge, and then sends no nudge', async () => {
      const post = await savePost({ created_at: daysAgo(1.5) })
      await answerOpenRequestNudge(author.id, { postId: post.id, answer: 'still_needed' })

      const [answered] = await nudgesFor(post.id)
      expect(answered.meta.answer).to.equal('still_needed')
      expect(answered.unread).to.equal(false)
      expect(await bookshelf.knex('notifications').where({ activity_id: answered.id })).to.have.length(0)

      // Day 3: the post is due, but its author has already answered
      expect(await sendOpenRequestNudges(new Date(Date.now() + 1.7 * DAY))).to.equal(0)
      expect(await nudgesFor(post.id)).to.have.length(1)
    })

    it('only lets the author answer, with a known answer, about a request or offer', async () => {
      const post = await savePost()
      const discussion = await savePost({ type: 'discussion' })
      await expect(answerOpenRequestNudge(other.id, { postId: post.id, answer: 'met' })).to.be.rejectedWith('Post not found')
      await expect(answerOpenRequestNudge(author.id, { postId: post.id, answer: 'maybe' })).to.be.rejectedWith('Unknown answer')
      await expect(answerOpenRequestNudge(author.id, { postId: discussion.id, answer: 'met' })).to.be.rejectedWith('Post not found')
      await expect(answerOpenRequestNudge(null, { postId: post.id, answer: 'met' })).to.be.rejected
    })
  })
})
