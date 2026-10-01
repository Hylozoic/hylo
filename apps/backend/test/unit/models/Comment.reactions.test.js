/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { REACTION_NOTICES, TABLE as ASSIGNMENTS } from '../../../lib/experiments'
import { noticesSettled } from '../../../api/models/notification/socialNotices'

// D15: reaction notices run as an experiment; the stored variant decides the arm
const assignVariant = (userId, variant) => bookshelf.knex(ASSIGNMENTS).insert({
  experiment: REACTION_NOTICES.name,
  subject_type: REACTION_NOTICES.subjectType,
  subject_id: userId,
  variant,
  assigned_at: new Date()
})

const reactionActivitiesFor = async userId => (await Activity.query(q => {
  q.where({ reader_id: userId })
  q.whereRaw("meta->'reasons' \\? 'reaction'")
}).fetchAll()).models

describe('Comment#addReaction notices (D15)', () => {
  let group, post, author, fan, otherFan

  const commentBy = (user, onPost = post) => factories.comment({ post_id: onPost.id, user_id: user.id }).save()

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    fan = await factories.user().save()
    otherFan = await factories.user().save()
    group = await factories.group().save()
    await group.addMembers([author, fan, otherFan])
    post = await factories.post({ user_id: fan.id, type: 'discussion' }).save()
    await group.posts().attach(post)
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex(ASSIGNMENTS).del()
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it('gives an author in the notices arm one grouped notice per comment', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)

    await comment.addReaction(fan.id, '👍')

    await noticesSettled()
    await comment.addReaction(otherFan.id, '🎉')
    await noticesSettled()

    const activities = await reactionActivitiesFor(author.id)
    expect(activities.length).to.equal(1)
    const [activity] = activities
    expect(String(activity.get('comment_id'))).to.equal(String(comment.id))
    expect(String(activity.get('post_id'))).to.equal(String(post.id))
    expect(activity.get('group_key')).to.equal(`reaction:comment:${comment.id}`)
    expect(activity.get('meta').actorCount).to.equal(2)
  })

  it('never emails a reaction notice', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)
    await comment.addReaction(fan.id, '👍')
    await noticesSettled()
    const [activity] = await reactionActivitiesFor(author.id)
    const media = (await Notification.where({ activity_id: activity.id }).fetchAll()).pluck('medium').sort()
    expect(media).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push].sort())
  })

  it('assigns but does not notify an author in the control arm', async () => {
    const comment = await commentBy(author)
    await assignVariant(author.id, 'control')
    await comment.addReaction(fan.id, '👍')
    await noticesSettled()

    expect(await reactionActivitiesFor(author.id)).to.have.length(0)
    const row = await bookshelf.knex(ASSIGNMENTS).where({ subject_id: author.id }).first()
    expect(row.variant).to.equal('control')
  })

  it('records the assignment the first time someone reacts', async () => {
    const comment = await commentBy(author)
    await comment.addReaction(fan.id, '👍')
    await noticesSettled()
    const row = await bookshelf.knex(ASSIGNMENTS).where({ experiment: REACTION_NOTICES.name, subject_id: author.id }).first()
    expect(row).to.exist
    expect(['control', 'notices']).to.include(row.variant)
  })

  it('does nothing when people react to their own comment', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)
    await comment.addReaction(author.id, '👍')
    await noticesSettled()
    expect(await reactionActivitiesFor(author.id)).to.have.length(0)
  })

  it('does nothing for comments on chat messages or in direct messages', async () => {
    await assignVariant(author.id, 'notices')
    for (const type of ['chat', 'thread']) {
      const otherPost = await factories.post({ user_id: fan.id, type }).save()
      const comment = await commentBy(author, otherPost)
      await comment.addReaction(fan.id, '👍')
      await noticesSettled()
    }
    expect(await reactionActivitiesFor(author.id)).to.have.length(0)
  })

  it('does nothing between people who have blocked each other', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)
    await BlockedUser.create(fan.id, author.id)
    try {
      await comment.addReaction(fan.id, '👍')
      await noticesSettled()
      expect(await reactionActivitiesFor(author.id)).to.have.length(0)
    } finally {
      await bookshelf.knex('blocked_users').del()
    }
  })

  it('does not notify when a reaction is removed', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)
    await comment.addReaction(fan.id, '👍')
    await noticesSettled()
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').del()

    await comment.deleteReaction(fan.id, '👍')
    expect(await reactionActivitiesFor(author.id)).to.have.length(0)
  })

  it('still saves the reaction when the notice fails', async () => {
    await assignVariant(author.id, 'notices')
    const comment = await commentBy(author)
    mockify(Activity, 'saveForReasons', () => Promise.reject(new Error('boom')))
    try {
      expect(await comment.addReaction(fan.id, '👍')).to.equal(comment)
      await noticesSettled()
    } finally {
      unspyify(Activity, 'saveForReasons')
    }
    expect((await comment.reactions().fetch()).length).to.be.at.least(1)
  })
})
