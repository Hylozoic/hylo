import { DateTime } from 'luxon'
import { RecurrenceHelpers } from '@hylo/shared'
import setup from '../../test/setup'
import factories from '../../test/setup/factories'

const LA = 'America/Los_Angeles'

describe('EventSeries', () => {
  let user, group

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
  })

  async function createEventPost (start) {
    const post = await factories.post({
      type: Post.Type.EVENT,
      user_id: user.id,
      start_time: start.toJSDate(),
      end_time: start.plus({ hours: 2 }).toJSDate(),
      timezone: LA
    }).save()
    await post.groups().attach(group.id)
    return post
  }

  // Anchored in the event timezone so weekly spacing matches wall-clock expansion
  function tomorrow () {
    return DateTime.now().setZone(LA).plus({ days: 1 }).startOf('hour')
  }

  describe('createForPost', () => {
    it('rejects invalid rules', async () => {
      const post = await createEventPost(tomorrow())
      let error
      await EventSeries.createForPost(post, 'FREQ=SOMETIMES').catch(e => { error = e })
      expect(error.message).to.equal('Invalid recurrence rule')
    })

    it('rejects non-event posts', async () => {
      const post = await factories.post({ type: Post.Type.DISCUSSION, user_id: user.id }).save()
      let error
      await EventSeries.createForPost(post, 'FREQ=WEEKLY').catch(e => { error = e })
      expect(error.message).to.equal('Recurrence is only supported for events')
    })

    it('materializes a bounded weekly series with copied attributes, groups and RSVPs', async () => {
      const start = tomorrow()
      const post = await createEventPost(start)

      const series = await EventSeries.createForPost(post, 'FREQ=WEEKLY;COUNT=5')

      await post.refresh()
      expect(String(post.get('event_series_id'))).to.equal(String(series.id))
      expect(post.get('original_start_time').getTime()).to.equal(start.toMillis())

      const occurrences = await series.activeOccurrences()
        .query(q => q.orderBy('posts.start_time', 'asc')).fetch()
      expect(occurrences.length).to.equal(5)
      expect(String(occurrences.first().id)).to.equal(String(post.id))

      const second = occurrences.at(1)
      expect(second.get('name')).to.equal(post.get('name'))
      expect(second.get('type')).to.equal(Post.Type.EVENT)
      expect(second.get('timezone')).to.equal(LA)
      expect(second.get('start_time').getTime()).to.equal(start.plus({ weeks: 1 }).toMillis())
      expect(second.get('end_time').getTime() - second.get('start_time').getTime())
        .to.equal(2 * 60 * 60 * 1000)
      expect(second.get('original_start_time').getTime()).to.equal(second.get('start_time').getTime())

      const secondGroups = await second.groups().fetch()
      expect(secondGroups.pluck('id').map(String)).to.deep.equal([String(group.id)])

      const invitation = await EventInvitation.find({ userId: user.id, eventId: second.id })
      expect(invitation.get('response')).to.equal(EventInvitation.RESPONSE.YES)
    })

    it('caps unbounded series at MAX_FUTURE_OCCURRENCES upcoming occurrences', async () => {
      const post = await createEventPost(tomorrow())

      const series = await EventSeries.createForPost(post, 'FREQ=DAILY')

      const occurrences = await series.activeOccurrences().fetch()
      expect(occurrences.length).to.equal(RecurrenceHelpers.MAX_FUTURE_OCCURRENCES)
    })
  })

  describe('generateOccurrences', () => {
    it('creates nothing more once the series is fully materialized', async () => {
      const post = await createEventPost(tomorrow())
      const series = await EventSeries.createForPost(post, 'FREQ=WEEKLY;COUNT=3')

      const created = await series.generateOccurrences()

      expect(created.length).to.equal(0)
      expect((await series.activeOccurrences().fetch()).length).to.equal(3)
    })

    it('does not recreate deleted occurrences', async () => {
      const post = await createEventPost(tomorrow())
      const series = await EventSeries.createForPost(post, 'FREQ=WEEKLY;COUNT=4')

      const last = await series.activeOccurrences()
        .query(q => q.orderBy('posts.start_time', 'desc')).fetchOne()
      await last.save({ active: false }, { patch: true })

      const created = await series.generateOccurrences()

      expect(created.length).to.equal(0)
      expect((await series.activeOccurrences().fetch()).length).to.equal(3)
    })
  })
})
