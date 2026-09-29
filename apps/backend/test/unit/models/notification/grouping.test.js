/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'
import {
  GROUPED_PUSH_INTERVAL_MINUTES,
  groupKeyFor,
  isGroupedKey,
  isGroupedPushThrottled,
  removeActivities,
  sentNoticeKeys
} from '../../../../api/models/notification/grouping'
import { markActivityRead } from '../../../../api/graphql/mutations/index'

const relations = [
  'activity',
  'activity.post',
  'activity.post.groups',
  'activity.post.user',
  'activity.reader',
  'activity.actor'
]

describe('notification/grouping', () => {
  let author, group, post, fans

  const reactionBy = actor => ({
    reader_id: author.id,
    actor_id: actor.id,
    post_id: post.id,
    reason: 'reaction',
    group_key: groupKeyFor('reaction', { postId: post.id })
  })

  const activitiesFor = async (userId = author.id) => (await Activity.where({ reader_id: userId }).query(q => q.orderBy('id')).fetchAll()).models

  const notificationsFor = activity => Notification.where({ activity_id: activity.id }).fetchAll()

  const newNotificationCount = async userId => (await User.find(userId)).get('new_notification_count')

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    fans = await Promise.all([1, 2, 3].map(() => factories.user().save()))
    group = await factories.group().save()
    await group.addMembers([author, ...fans])
    post = await factories.post({ user_id: author.id, type: 'discussion' }).save()
    await group.posts().attach(post)
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    mockify(OneSignal, 'notify', () => Promise.resolve(true))
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('push_notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex('users').update({ new_notification_count: 0 })
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    unspyify(OneSignal, 'notify')
  })

  describe('groupKeyFor and isGroupedKey', () => {
    it('names the item a notice is about', () => {
      expect(groupKeyFor('reaction', { postId: 7 })).to.equal('reaction:post:7')
      expect(groupKeyFor('reaction', { postId: 7, commentId: 9 })).to.equal('reaction:comment:9')
    })

    it('groups only social feedback reasons', () => {
      expect(isGroupedKey('reaction:post:7')).to.be.true
      expect(isGroupedKey('eventRsvp:post:7')).to.be.true
      expect(isGroupedKey('proposalVote:post:7')).to.be.true
      expect(isGroupedKey('eventReminder:post:7')).to.be.false
      expect(isGroupedKey(null)).to.be.false
    })
  })

  describe('in-app grouping', () => {
    it('two reactions give one unread activity that counts both people', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      await Activity.saveForReasons([reactionBy(fans[1])])

      const activities = await activitiesFor()
      expect(activities.length).to.equal(1)
      const [activity] = activities
      expect(activity.get('unread')).to.be.true
      expect(String(activity.get('actor_id'))).to.equal(String(fans[1].id))
      expect(activity.get('meta').actorCount).to.equal(2)
      expect(activity.get('meta').actorIds).to.deep.equal([String(fans[1].id), String(fans[0].id)])
      expect(activity.get('meta').reasons).to.deep.equal(['reaction'])

      const inApp = (await notificationsFor(activity)).filter(n => n.get('medium') === Notification.MEDIUM.InApp)
      expect(inApp.length).to.equal(1)
      const allInApp = await Notification.where({ user_id: author.id, medium: Notification.MEDIUM.InApp }).fetchAll()
      expect(allInApp.length).to.equal(1)
    })

    it('names the activity it replaced, so an open web app can drop it', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      expect(first.get('meta').replaces).to.not.exist

      await Activity.saveForReasons([reactionBy(fans[1])])
      const [second] = await activitiesFor()
      expect(second.get('meta').replaces).to.deep.equal([String(first.id)])
    })

    it('lets an open bell mark the replaced notice read without an error', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      await Activity.saveForReasons([reactionBy(fans[1])])
      expect(await markActivityRead(author.id, first.id)).to.not.exist
    })

    it('adds nothing when the same person reacts again', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      await Activity.saveForReasons([reactionBy(fans[0])])

      const activities = await activitiesFor()
      expect(activities.length).to.equal(1)
      expect(activities[0].id).to.equal(first.id)
      expect(activities[0].get('meta').actorCount).to.equal(1)
    })

    it('starts a new group once the reader has read the last one', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      await bookshelf.knex('activities').update({ unread: false })
      await Activity.saveForReasons([reactionBy(fans[1])])

      const activities = await activitiesFor()
      expect(activities.length).to.equal(2)
      expect(activities[1].get('unread')).to.be.true
      expect(activities[1].get('meta').actorCount).to.equal(1)
    })

    it('does not group notices for different items or readers', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      await Activity.saveForReasons([{ ...reactionBy(fans[1]), group_key: groupKeyFor('reaction', { postId: post.id, commentId: 1 }) }])
      expect((await activitiesFor()).length).to.equal(2)
    })

    it('keeps the unread count consistent when a sent notice is replaced', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      const firstInApp = (await notificationsFor(first)).find(n => n.get('medium') === Notification.MEDIUM.InApp)
      await firstInApp.load(['activity', 'activity.post', 'activity.reader', 'activity.actor'])
      mockify(firstInApp, 'updateUserSocketRoom', () => {})
      await firstInApp.send()
      expect(await newNotificationCount(author.id)).to.equal(1)

      await Activity.saveForReasons([reactionBy(fans[1])])
      expect(await newNotificationCount(author.id)).to.equal(0)

      const [second] = await activitiesFor()
      const secondInApp = (await notificationsFor(second)).find(n => n.get('medium') === Notification.MEDIUM.InApp)
      await secondInApp.load(['activity', 'activity.post', 'activity.reader', 'activity.actor'])
      mockify(secondInApp, 'updateUserSocketRoom', () => {})
      await secondInApp.send()
      expect(await newNotificationCount(author.id)).to.equal(1)
    })

    it('lets a send finish when its row was replaced while it was being sent', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      const push = (await notificationsFor(first)).find(n => n.get('medium') === Notification.MEDIUM.Push)
      await push.load(relations)
      await Activity.saveForReasons([reactionBy(fans[1])])
      expect(await Notification.where({ id: push.id }).fetch()).to.not.exist
      await push.send()
    })

    it('does not change the count when the replaced notice was never sent', async () => {
      await User.query().where({ id: author.id }).update({ new_notification_count: 3 })
      await Activity.saveForReasons([reactionBy(fans[0])])
      await Activity.saveForReasons([reactionBy(fans[1])])
      expect(await newNotificationCount(author.id)).to.equal(3)
    })
  })

  describe('push throttle', () => {
    const pushFor = async activity => {
      const push = (await notificationsFor(activity)).find(n => n.get('medium') === Notification.MEDIUM.Push)
      return push && push.load(relations)
    }

    it('sends the first grouped push and suppresses a second one inside the hour', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      const firstPush = await pushFor(first)
      expect(firstPush).to.exist
      expect(await isGroupedPushThrottled(firstPush)).to.be.false
      await firstPush.send()
      expect((await Notification.where({ id: firstPush.id }).fetch()).get('sent_at')).to.exist
      expect((await Activity.find(first.id)).get('meta').lastPushAt).to.exist

      await Activity.saveForReasons([reactionBy(fans[1])])
      const [second] = await activitiesFor()
      expect(second.get('meta').lastPushAt).to.exist
      const secondPush = await pushFor(second)
      expect(await isGroupedPushThrottled(secondPush)).to.be.true
      const secondPushId = secondPush.id
      await secondPush.send()
      expect(await Notification.where({ id: secondPushId }).fetch()).to.not.exist
    })

    it('sends again once the hour has passed', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const longAgo = new Date(Date.now() - (GROUPED_PUSH_INTERVAL_MINUTES + 5) * 60 * 1000).toISOString()
      await bookshelf.knex('activities').update({ meta: bookshelf.knex.raw("meta || jsonb_build_object('lastPushAt', ?::text)", [longAgo]) })
      await Activity.saveForReasons([reactionBy(fans[1])])
      const [second] = await activitiesFor()
      const secondPush = await pushFor(second)
      expect(await isGroupedPushThrottled(secondPush)).to.be.false
    })

    it('counts a push sent for an earlier group the reader has read', async () => {
      await Activity.saveForReasons([reactionBy(fans[0])])
      const [first] = await activitiesFor()
      await (await pushFor(first)).send()
      await bookshelf.knex('activities').update({ unread: false })

      await Activity.saveForReasons([reactionBy(fans[1])])
      const activities = await activitiesFor()
      const latest = activities[activities.length - 1]
      expect(await isGroupedPushThrottled(await pushFor(latest))).to.be.true
    })

    it('never throttles notices that are not grouped', async () => {
      const activity = await new Activity({ reader_id: author.id, actor_id: fans[0].id, post_id: post.id, meta: { reasons: ['mention'] } }).save()
      const push = await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.Push, user_id: author.id }).save()
      await push.load(relations)
      expect(await isGroupedPushThrottled(push)).to.be.false
    })
  })

  describe('removeActivities', () => {
    it('removes activities with their notifications and takes back counted in-app notices', async () => {
      const activity = await new Activity({ reader_id: author.id, actor_id: fans[0].id, post_id: post.id, meta: { reasons: ['mention'] } }).save()
      await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.InApp, user_id: author.id, sent_at: new Date() }).save()
      await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.Push, user_id: author.id, sent_at: new Date() }).save()
      await User.query().where({ id: author.id }).update({ new_notification_count: 2 })

      await removeActivities([activity.id])

      expect(await Activity.where({ id: activity.id }).fetch()).to.not.exist
      expect((await notificationsFor(activity)).length).to.equal(0)
      expect(await newNotificationCount(author.id)).to.equal(1)
    })

    it('takes back each reader\'s own count, in one pass for many readers', async () => {
      const readers = [author, ...fans]
      const activities = []
      for (const [i, reader] of readers.entries()) {
        await User.query().where({ id: reader.id }).update({ new_notification_count: 5 })
        for (let n = 0; n <= i; n++) {
          const activity = await new Activity({ reader_id: reader.id, actor_id: fans[0].id, post_id: post.id, meta: { reasons: ['newPost'] } }).save()
          await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.InApp, user_id: reader.id, sent_at: new Date() }).save()
          activities.push(activity)
        }
      }

      await bookshelf.transaction(trx => removeActivities(activities.map(a => a.id), trx))

      for (const [i, reader] of readers.entries()) {
        expect(await newNotificationCount(reader.id)).to.equal(5 - (i + 1))
      }
      expect((await Activity.where('id', 'in', activities.map(a => a.id)).fetchAll()).length).to.equal(0)
    })

    it('never takes the count below zero, and leaves it alone for read notices', async () => {
      const unread = await new Activity({ reader_id: author.id, actor_id: fans[0].id, post_id: post.id, meta: { reasons: ['mention'] } }).save()
      const read = await new Activity({ reader_id: author.id, actor_id: fans[1].id, post_id: post.id, unread: false, meta: { reasons: ['mention'] } }).save()
      for (const activity of [unread, read]) {
        await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.InApp, user_id: author.id, sent_at: new Date() }).save()
      }

      await removeActivities([unread.id, read.id])
      expect(await newNotificationCount(author.id)).to.equal(0)
    })

    it('is what Activity.removeForComment uses', async () => {
      const comment = await factories.comment({ post_id: post.id, user_id: fans[0].id }).save()
      const activity = await new Activity({ reader_id: author.id, actor_id: fans[0].id, post_id: post.id, comment_id: comment.id, meta: { reasons: ['newComment'] } }).save()
      await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.InApp, user_id: author.id, sent_at: new Date() }).save()
      await User.query().where({ id: author.id }).update({ new_notification_count: 1 })

      await Activity.removeForComment(comment.id)
      expect(await Activity.where({ id: activity.id }).fetch()).to.not.exist
      expect(await newNotificationCount(author.id)).to.equal(0)
    })
  })

  describe('sentNoticeKeys', () => {
    it('returns the keys some activity already carries', async () => {
      await new Activity({ reader_id: author.id, post_id: post.id, group_key: 'eventReminder:post:1', meta: { reasons: ['eventReminder'] } }).save()
      const sent = await sentNoticeKeys(['eventReminder:post:1', 'eventReminder:post:2'])
      expect([...sent]).to.deep.equal(['eventReminder:post:1'])
      expect((await sentNoticeKeys([])).size).to.equal(0)
    })
  })
})
