/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { REACTION_NOTICES, TABLE as ASSIGNMENTS } from '../../../lib/experiments'

const activitiesWithReason = async (reason, where = {}) => (await Activity.query(q => {
  q.where(where)
  q.whereRaw("meta->'reasons' \\? ?", [reason])
  q.orderBy('id')
}).fetchAll()).models

const mediaFor = async activity =>
  (await Notification.where({ activity_id: activity.id }).fetchAll()).pluck('medium').sort()

const { InApp, Push } = { InApp: 0, Push: 1 }

describe('Post notices', () => {
  let group, author, fans

  before(async () => {
    await setup.clearDb()
    author = await factories.user({ name: 'Ada Author' }).save()
    fans = await Promise.all(['Sam', 'Kim', 'Lee'].map(name => factories.user({ name }).save()))
    group = await factories.group({ name: 'Garden Group' }).save()
    await group.addMembers([author, ...fans])
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    mockify(OneSignal, 'notify', () => Promise.resolve(true))
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('push_notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex(ASSIGNMENTS).del()
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    unspyify(OneSignal, 'notify')
  })

  const postBy = async (user, attrs = {}) => {
    const post = await factories.post({ user_id: user.id, type: 'discussion', name: 'Seed swap on Saturday', ...attrs }).save()
    await group.posts().attach(post)
    return post
  }

  describe('reactions (D15)', () => {
    const assignVariant = (userId, variant) => bookshelf.knex(ASSIGNMENTS).insert({
      experiment: REACTION_NOTICES.name,
      subject_type: REACTION_NOTICES.subjectType,
      subject_id: userId,
      variant,
      assigned_at: new Date()
    })

    it('gives an author in the notices arm one grouped notice, in-app and push', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await post.addReaction(fans[1].id, '🎉')
      await post.addReaction(fans[1].id, '👍')

      const activities = await activitiesWithReason('reaction', { reader_id: author.id })
      expect(activities.length).to.equal(1)
      expect(activities[0].get('group_key')).to.equal(`reaction:post:${post.id}`)
      expect(activities[0].get('meta').actorCount).to.equal(2)
      expect(await mediaFor(activities[0])).to.deep.equal([InApp, Push])
    })

    it('pushes the grouped text and collapses later pushes for the same post', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await post.addReaction(fans[1].id, '👍')

      const [activity] = await activitiesWithReason('reaction', { reader_id: author.id })
      const push = await Notification.where({ activity_id: activity.id, medium: Push }).fetch({
        withRelated: ['activity', 'activity.post', 'activity.post.groups', 'activity.post.user', 'activity.reader', 'activity.actor', 'activity.comment']
      })
      await push.send()
      const opts = OneSignal.notify.__spy.calls[0][0]
      expect(opts.alert).to.equal('Kim and 1 other reacted to your post "Seed swap on Saturday"')
      expect(opts.collapseKey).to.equal(`reaction:post:${post.id}`)
      expect(opts.heading).to.equal('Garden Group')
    })

    it('does not notify an author in the control arm', async () => {
      await assignVariant(author.id, 'control')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })

    it('does nothing for a self-reaction, and does not assign the author', async () => {
      const post = await postBy(author)
      await post.addReaction(author.id, '👍')
      expect(await activitiesWithReason('reaction')).to.have.length(0)
      expect(await bookshelf.knex(ASSIGNMENTS).where({ subject_id: author.id }).first()).to.not.exist
    })

    it('does nothing for reactions to chat messages', async () => {
      await assignVariant(author.id, 'notices')
      const chat = await postBy(author, { type: 'chat' })
      await chat.addReaction(fans[0].id, '👍')
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })

    it('does not notify when a reaction is removed', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await bookshelf.knex('notifications').del()
      await bookshelf.knex('activities').del()
      await post.deleteReaction(fans[0].id, '👍')
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })
  })
})
