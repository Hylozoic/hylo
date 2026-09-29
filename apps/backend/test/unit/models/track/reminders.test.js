/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'
import { createTrack, enrollInTrack, leaveTrack } from '../../../../api/graphql/mutations/track'
import {
  TRACK_REMINDER_REASON,
  dueReminderIndex,
  sendTrackReminders
} from '../../../../api/models/track/reminders'

const DAY = 24 * 60 * 60 * 1000

describe('track reminders (D63)', () => {
  describe('dueReminderIndex', () => {
    const cases = [
      [{ idleDays: 6, sent: 0 }, null, 'not idle long enough'],
      [{ idleDays: 7, sent: 0 }, 0, 'the 7-day reminder'],
      [{ idleDays: 20, sent: 0 }, 0, 'the 7-day reminder, a missed run later'],
      [{ idleDays: 10, sent: 1, daysSinceLastReminder: 3 }, null, 'the 7-day reminder only once'],
      [{ idleDays: 21, sent: 1, daysSinceLastReminder: 14 }, 1, 'the 21-day reminder'],
      [{ idleDays: 22, sent: 1, daysSinceLastReminder: 2 }, null, 'never two reminders within a week'],
      [{ idleDays: 25, sent: 0 }, 1, 'only the 21-day one for someone first seen at 25 days'],
      [{ idleDays: 22, sent: 2, daysSinceLastReminder: 30 }, null, 'never a third'],
      [{ idleDays: 40, sent: 0 }, null, 'nothing for someone idle far longer']
    ]
    for (const [state, expected, label] of cases) {
      it(label, () => {
        expect(dueReminderIndex(state)).to.equal(expected)
      })
    }
  })

  describe('sendTrackReminders', () => {
    let steward, group, space, track, actions

    before(async () => {
      await setup.clearDb()
      steward = await factories.user().save()
      group = await factories.group().save()
      await group.addMembers([steward.id])
      space = await factories.group({ type: 'space', parent_id: group.id, name: 'Composting basics', slug: `compost-${Date.now()}` }).save()
      await Group.setupSpaceViews(space.id, [], ['track-actions', 'members'])
      track = await createTrack(steward.id, { groupId: space.id })
      actions = []
      for (const name of ['Watch the intro', 'Build a bin']) {
        const action = await factories.post({ type: 'action', user_id: steward.id, name }).save()
        await action.groups().attach([space.id])
        await Track.addPost(action, await Track.find(track.id))
        actions.push(action)
      }
    })

    after(() => setup.clearDb())

    beforeEach(() => mockify(Queue, 'classMethod', () => Promise.resolve()))
    afterEach(() => unspyify(Queue, 'classMethod'))

    // A learner enrolled `days` ago, with their group email setting
    async function enrolledLearner ({ days, sendEmail = true, settings = {} } = {}) {
      const learner = await factories.user().save()
      await group.addMembers([learner.id], { settings: { sendEmail, sendPushNotifications: true, digestFrequency: 'daily', postNotifications: 'all' } })
      await enrollInTrack(learner.id, track.id)
      const membership = await GroupMembership.forPair(learner.id, space.id).fetch()
      await membership.save({
        created_at: new Date(Date.now() - days * DAY),
        settings: { ...membership.get('settings'), ...settings }
      }, { patch: true })
      return learner
    }

    const remindersFor = learner => bookshelf.knex('activities')
      .where({ reader_id: learner.id })
      .whereRaw('meta -> \'reasons\' @> ?::jsonb', [JSON.stringify([TRACK_REMINDER_REASON])])
      .orderBy('id')
    const settingsOf = async learner => (await GroupMembership.forPair(learner.id, space.id).fetch()).get('settings')
    const mediaFor = activity => bookshelf.knex('notifications').where({ activity_id: activity.id }).pluck('medium')

    it('reminds after 7 idle days and again after 21, never more than twice, linking to the next action', async () => {
      const learner = await enrolledLearner({ days: 8 })
      await actions[0].complete(learner.id, JSON.stringify(['done']))
      await Post.checkCompletedTrack({ userId: learner.id, postId: actions[0].id })
      // Their last action was 8 days ago
      const membership = await GroupMembership.forPair(learner.id, space.id).fetch()
      membership.addSetting({ lastActionAt: new Date(Date.now() - 8 * DAY).toISOString() })
      await membership.save({ settings: membership.get('settings') }, { patch: true })

      await sendTrackReminders()
      let reminders = await remindersFor(learner)
      expect(reminders).to.have.length(1)
      expect(String(reminders[0].post_id)).to.equal(String(actions[1].id))
      expect(String(reminders[0].track_id)).to.equal(String(track.id))
      expect(reminders[0].meta.reminderNumber).to.equal(1)
      expect((await mediaFor(reminders[0])).sort()).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Email].sort())
      expect((await settingsOf(learner)).trackRemindersSent).to.equal(1)

      // Nothing more the same day
      await sendTrackReminders()
      expect(await remindersFor(learner)).to.have.length(1)

      // 21 idle days
      await sendTrackReminders(new Date(Date.now() + 13 * DAY))
      reminders = await remindersFor(learner)
      expect(reminders).to.have.length(2)
      expect(reminders[1].meta.reminderNumber).to.equal(2)
      expect((await settingsOf(learner)).trackRemindersSent).to.equal(2)

      // Never a third
      await sendTrackReminders(new Date(Date.now() + 20 * DAY))
      expect(await remindersFor(learner)).to.have.length(2)
    })

    it('reminds only in the app when the group\'s email is off', async () => {
      const learner = await enrolledLearner({ days: 8, sendEmail: false })
      await sendTrackReminders()
      const [reminder] = await remindersFor(learner)
      expect(reminder).to.exist
      expect(String(reminder.post_id)).to.equal(String(actions[0].id))
      expect(await mediaFor(reminder)).to.deep.equal([Notification.MEDIUM.InApp])
    })

    it('leaves alone learners who are active, finished, or idle far too long', async () => {
      const recent = await enrolledLearner({ days: 3 })
      const finished = await enrolledLearner({ days: 10, settings: { completedAt: new Date().toISOString() } })
      const longGone = await enrolledLearner({ days: 90 })
      const activeLately = await enrolledLearner({ days: 30, settings: { lastActionAt: new Date(Date.now() - 2 * DAY).toISOString() } })

      await sendTrackReminders()
      for (const learner of [recent, finished, longGone, activeLately]) {
        expect(await remindersFor(learner)).to.have.length(0)
      }
    })

    it('gives a new enrollment a fresh allowance', async () => {
      const learner = await enrolledLearner({ days: 8, settings: { trackRemindersSent: 2, trackReminderLastAt: new Date(Date.now() - 20 * DAY).toISOString() } })
      await sendTrackReminders()
      expect(await remindersFor(learner)).to.have.length(0)

      await leaveTrack(learner.id, track.id)
      await enrollInTrack(learner.id, track.id)
      const settings = await settingsOf(learner)
      expect(settings.trackRemindersSent).to.be.undefined
      expect(settings.trackReminderLastAt).to.be.undefined
    })
  })
})
