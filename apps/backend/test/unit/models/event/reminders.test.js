/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'
import { reminderKeyFor, sendEventReminders } from '../../../../api/models/event/reminders'

const HOUR = 60 * 60 * 1000

const relations = [
  'activity',
  'activity.post',
  'activity.post.groups',
  'activity.post.user',
  'activity.reader',
  'activity.actor'
]

const noticesFor = async (reason, eventId) => (await Activity.query(q => {
  q.where({ post_id: eventId })
  q.whereRaw("meta->'reasons' \\? ?", [reason])
  q.orderBy('reader_id')
}).fetchAll()).models

const readerIds = activities => activities.map(a => String(a.get('reader_id'))).sort()

const mediaFor = async activity =>
  (await Notification.where({ activity_id: activity.id }).fetchAll()).pluck('medium').sort()

describe('event reminders (D44)', () => {
  let host, going, interested, declined, unanswered, emailOff, group

  const eventStarting = async (hoursFromNow, attrs = {}) => {
    const start = new Date(Date.now() + hoursFromNow * HOUR)
    const event = await factories.post({
      type: Post.Type.EVENT,
      user_id: host.id,
      name: 'Seed swap',
      start_time: start,
      end_time: new Date(start.getTime() + 2 * HOUR),
      timezone: 'America/Los_Angeles',
      location: 'Community garden',
      ...attrs
    }).save()
    await group.posts().attach(event)
    const answers = [
      [host, 'yes'], [going, 'yes'], [interested, 'interested'], [declined, 'no'], [unanswered, null], [emailOff, 'yes']
    ]
    for (const [user, response] of answers) {
      await EventInvitation.create({ userId: user.id, inviterId: host.id, eventId: event.id, response })
    }
    return event
  }

  before(async () => {
    await setup.clearDb()
    host = await factories.user({ name: 'Hana Host' }).save()
    going = await factories.user().save()
    interested = await factories.user().save()
    declined = await factories.user().save()
    unanswered = await factories.user().save()
    emailOff = await factories.user().save()
    group = await factories.group({ name: 'Garden Group' }).save()
    await group.addMembers([host, going, interested, declined, unanswered, emailOff])
    const membership = await GroupMembership.forPair(emailOff, group).fetch()
    membership.addSetting({ sendEmail: false })
    await membership.save({ settings: membership.get('settings') }, { patch: true })
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex('posts').where({ type: Post.Type.EVENT }).update({ active: false })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it("reminds people going or interested, nudges unanswered invitees, and leaves out 'no' and the host", async () => {
    const event = await eventStarting(24)
    const result = await sendEventReminders()
    expect(result).to.deep.equal({ events: 1, reminded: 3, nudged: 1 })

    const reminders = await noticesFor('eventReminder', event.id)
    expect(readerIds(reminders)).to.deep.equal([going.id, interested.id, emailOff.id].map(String).sort())
    const nudges = await noticesFor('eventNudge', event.id)
    expect(readerIds(nudges)).to.deep.equal([String(unanswered.id)])
    expect(reminders[0].get('group_key')).to.equal(reminderKeyFor(event))
  })

  it('sends reminders by push and email, nudges in-app only, and follows the group email setting', async () => {
    const event = await eventStarting(24)
    await sendEventReminders()
    const reminders = await noticesFor('eventReminder', event.id)
    const byReader = id => reminders.find(a => String(a.get('reader_id')) === String(id))
    expect(await mediaFor(byReader(going.id))).to.deep.equal([Notification.MEDIUM.Push, Notification.MEDIUM.Email])
    expect(await mediaFor(byReader(emailOff.id))).to.deep.equal([Notification.MEDIUM.Push])
    const [nudge] = await noticesFor('eventNudge', event.id)
    expect(await mediaFor(nudge)).to.deep.equal([Notification.MEDIUM.InApp])
  })

  it('catches each event exactly once across hourly runs', async () => {
    const event = await eventStarting(24.5)
    await sendEventReminders()
    await sendEventReminders()
    await sendEventReminders({ now: new Date(Date.now() + HOUR) })
    expect(await noticesFor('eventReminder', event.id)).to.have.length(3)
    expect(await noticesFor('eventNudge', event.id)).to.have.length(1)
  })

  it('waits until about a day before, and still catches an event a run missed', async () => {
    const later = await eventStarting(30)
    const soon = await eventStarting(10)
    const missed = await eventStarting(23)
    await sendEventReminders()
    expect(await noticesFor('eventReminder', later.id)).to.have.length(0)
    expect(await noticesFor('eventReminder', soon.id)).to.have.length(0)
    expect(await noticesFor('eventReminder', missed.id)).to.have.length(3)
  })

  it('reminds again when the event moves to another time', async () => {
    const event = await eventStarting(24)
    await sendEventReminders()
    await event.save({ start_time: new Date(Date.now() + 24.5 * HOUR) }, { patch: true })
    await sendEventReminders()
    expect(await noticesFor('eventReminder', event.id)).to.have.length(6)
  })

  describe('delivery', () => {
    let originalTemplateId
    beforeEach(() => {
      originalTemplateId = process.env.EVENT_REMINDER_TEMPLATE_ID
      mockify(OneSignal, 'notify', () => Promise.resolve(true))
      mockify(Email, 'sendEventReminderEmail', () => Promise.resolve(true))
    })
    afterEach(() => {
      if (originalTemplateId === undefined) delete process.env.EVENT_REMINDER_TEMPLATE_ID
      else process.env.EVENT_REMINDER_TEMPLATE_ID = originalTemplateId
      unspyify(OneSignal, 'notify')
      unspyify(Email, 'sendEventReminderEmail')
    })

    const notificationFor = async (medium) => {
      const event = await eventStarting(24)
      await sendEventReminders()
      const reminder = (await noticesFor('eventReminder', event.id)).find(a => String(a.get('reader_id')) === String(going.id))
      const notification = await Notification.where({ activity_id: reminder.id, medium }).fetch({ withRelated: relations })
      return { event, notification }
    }

    it('pushes the event name and time in the event timezone', async () => {
      const { notification } = await notificationFor(Notification.MEDIUM.Push)
      await notification.send()
      const { alert, heading } = OneSignal.notify.__spy.calls[0][0]
      expect(alert).to.match(/^Reminder: "Seed swap" is coming up, /)
      expect(alert).to.match(/P[DS]T/)
      expect(heading).to.equal('Garden Group')
    })

    it('emails the event details once the template is named', async () => {
      process.env.EVENT_REMINDER_TEMPLATE_ID = 'tem_test'
      const { event, notification } = await notificationFor(Notification.MEDIUM.Email)
      await notification.sendEmail()
      const [opts] = Email.sendEventReminderEmail.__spy.calls[0]
      expect(opts.email).to.equal(going.get('email'))
      expect(opts.data.event_name).to.equal('Seed swap')
      expect(opts.data.going).to.be.true
      expect(opts.data.group_name).to.equal('Garden Group')
      expect(opts.data.event_location).to.equal('Community garden')
      expect(opts.data.date).to.match(/P[DS]T/)
      expect(opts.data.event_url).to.include(`/post/${event.id}`)
    })

    it('skips the email while no template is named', async () => {
      delete process.env.EVENT_REMINDER_TEMPLATE_ID
      const { notification } = await notificationFor(Notification.MEDIUM.Email)
      expect(await notification.sendEmail()).to.equal(Notification.EMAIL_SKIPPED)
      expect(Email.sendEventReminderEmail).to.not.have.been.called()
    })
  })
})
