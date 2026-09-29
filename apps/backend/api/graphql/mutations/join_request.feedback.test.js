/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { createJoinRequest, acceptJoinRequest, declineJoinRequest } from './join_request'

const DAY = 24 * 60 * 60 * 1000

// Activities for this reader with this reason, each with the media of its notifications
async function noticesFor (readerId, reason) {
  const activities = await Activity.query(q => {
    q.where('reader_id', readerId)
    q.whereRaw("meta->'reasons' \\? ?", [reason])
    q.orderBy('id')
  }).fetchAll({ withRelated: 'notifications' })
  return activities.models.map(activity => ({
    activity,
    media: activity.related('notifications').map(n => n.get('medium')).sort()
  }))
}

// Model globals only exist once the test setup has lifted
const inAppAndEmail = () => [Notification.MEDIUM.InApp, Notification.MEDIUM.Email].sort()

describe('join request feedback (D14)', () => {
  let group, steward

  before(async () => {
    await setup.clearDb()
    group = await factories.group({ name: 'Seed Library' }).save()
    steward = await factories.user().save()
    await assignAdministrator(steward, group)
  })

  after(() => setup.clearDb())

  it('acknowledges a new request in-app and by email, although the person is not a member', async () => {
    const requester = await factories.user().save()
    await createJoinRequest(requester.id, group.id, [])

    const notices = await noticesFor(requester.id, 'acknowledgedJoinRequest')
    expect(notices).to.have.length(1)
    expect(notices[0].media).to.deep.equal(inAppAndEmail())
    expect(String(notices[0].activity.get('actor_id'))).to.equal(String(requester.id))
    expect(String(notices[0].activity.get('group_id'))).to.equal(String(group.id))

    // Asking again while the request is pending doesn't acknowledge twice
    await createJoinRequest(requester.id, group.id, [])
    expect(await noticesFor(requester.id, 'acknowledgedJoinRequest')).to.have.length(1)

    // The stewards still get the request notice
    expect(await noticesFor(steward.id, 'joinRequest')).to.not.be.empty
  })

  it('tells the person neutrally when a request is declined, once', async () => {
    const requester = await factories.user().save()
    const { request } = await createJoinRequest(requester.id, group.id, [])
    await declineJoinRequest(steward.id, request.id)

    const notices = await noticesFor(requester.id, 'declinedJoinRequest')
    expect(notices).to.have.length(1)
    expect(notices[0].media).to.deep.equal(inAppAndEmail())
    // The notice doesn't name the steward who declined
    expect(String(notices[0].activity.get('actor_id'))).to.equal(String(requester.id))

    await declineJoinRequest(steward.id, request.id)
    expect(await noticesFor(requester.id, 'declinedJoinRequest')).to.have.length(1)
  })

  it('leaves accepting unchanged', async () => {
    const requester = await factories.user().save()
    const { request } = await createJoinRequest(requester.id, group.id, [])
    await acceptJoinRequest(steward.id, request.id)

    expect((await JoinRequest.find(request.id)).get('status')).to.equal(JoinRequest.STATUS.Accepted)
    expect(await GroupMembership.forPair(requester.id, group.id).fetch()).to.exist
    expect(await noticesFor(requester.id, 'approvedJoinRequest')).to.have.length(1)
    expect(await noticesFor(requester.id, 'declinedJoinRequest')).to.be.empty
    expect(await noticesFor(requester.id, 'unansweredJoinRequest')).to.be.empty
  })

  describe('JoinRequest.notifyUnanswered', () => {
    let waiting, recent, old, joinedAnyway, now

    const requestFrom = async (user, daysAgo) => {
      const { request } = await createJoinRequest(user.id, group.id, [])
      await request.save({ created_at: new Date(now.getTime() - daysAgo * DAY) }, { patch: true })
      return request
    }

    before(async () => {
      now = new Date()
      waiting = await factories.user().save()
      recent = await factories.user().save()
      old = await factories.user().save()
      joinedAnyway = await factories.user().save()
      await requestFrom(waiting, 15)
      await requestFrom(recent, 10)
      await requestFrom(old, 45)
      await requestFrom(joinedAnyway, 16)
      await joinedAnyway.joinGroup(group)
    })

    it('tells people whose request has waited 14 days, once, and marks the request', async () => {
      expect(await JoinRequest.notifyUnanswered({ now })).to.equal(1)

      const notices = await noticesFor(waiting.id, 'unansweredJoinRequest')
      expect(notices).to.have.length(1)
      expect(notices[0].media).to.deep.equal(inAppAndEmail())
      const request = await JoinRequest.where({ user_id: waiting.id, group_id: group.id }).fetch()
      expect(request.get('unanswered_notified_at')).to.exist
      expect(request.get('status')).to.equal(JoinRequest.STATUS.Pending)

      expect(await JoinRequest.notifyUnanswered({ now })).to.equal(0)
      expect(await noticesFor(waiting.id, 'unansweredJoinRequest')).to.have.length(1)
    })

    it('leaves recent requests, requests from long ago and people who joined anyway alone', async () => {
      for (const person of [recent, old, joinedAnyway]) {
        expect(await noticesFor(person.id, 'unansweredJoinRequest')).to.be.empty
      }
    })

    it('keeps the note in-app only for someone who turned email down', async () => {
      const unsubscribed = await factories.user({ settings: { locale: 'en-US', email_unsubscribe_scope: 'everything' } }).save()
      await requestFrom(unsubscribed, 15)
      await JoinRequest.notifyUnanswered({ now })
      const notices = await noticesFor(unsubscribed.id, 'unansweredJoinRequest')
      expect(notices).to.have.length(1)
      expect(notices[0].media).to.deep.equal([Notification.MEDIUM.InApp])
    })
  })

  describe('the emails', () => {
    let openGroup, requester

    before(async () => {
      requester = await factories.user({ first_name: 'Rey' }).save()
      openGroup = await factories.group({
        name: 'Tool Library',
        visibility: Group.Visibility.PUBLIC,
        accessibility: Group.Accessibility.OPEN,
        allow_in_public: true,
        active: true
      }).save()
      const post = await factories.post({ user_id: steward.id, type: 'discussion', created_at: new Date() }).save()
      await bookshelf.knex('groups_posts').insert({ post_id: post.id, group_id: openGroup.id })
    })

    afterEach(() => {
      unspyify(Email, 'sendJoinRequestReceived')
      unspyify(Email, 'sendJoinRequestUnanswered')
    })

    const emailNotification = async (readerId, reason) => {
      const [{ activity }] = await noticesFor(readerId, reason)
      return Notification.query(q => {
        q.where({ activity_id: activity.id, medium: Notification.MEDIUM.Email })
      }).fetch({ withRelated: ['activity', 'activity.reader', 'activity.actor', 'activity.group', 'activity.otherGroup'] })
    }

    it('sends the acknowledgment with the group, a subject and where to look meanwhile', async () => {
      mockify(Email, 'sendJoinRequestReceived', () => Promise.resolve(true))
      await createJoinRequest(requester.id, group.id, [])
      const notification = await emailNotification(requester.id, 'acknowledgedJoinRequest')
      await notification.sendEmail()

      expect(Email.sendJoinRequestReceived).to.have.been.called()
      const { email, data } = Email.sendJoinRequestReceived.__spy.calls[0][0]
      expect(email).to.equal(requester.get('email'))
      expect(data.subject).to.equal('Your request to join Seed Library was sent')
      expect(data.group_name).to.equal('Seed Library')
      expect(data.group_url).to.match(new RegExp(`/groups/${group.get('slug')}/about`))
      expect(data.explore_url).to.match(/\/public\/groups/)
      expect(data.first_name).to.equal('Rey')
    })

    it('suggests open groups in the 14-day note', async () => {
      mockify(Email, 'sendJoinRequestUnanswered', () => Promise.resolve(true))
      const request = await JoinRequest.where({ user_id: requester.id, group_id: group.id }).fetch()
      await request.save({ created_at: new Date(Date.now() - 15 * DAY) }, { patch: true })
      await JoinRequest.notifyUnanswered()
      const notification = await emailNotification(requester.id, 'unansweredJoinRequest')
      await notification.sendEmail()

      const { data } = Email.sendJoinRequestUnanswered.__spy.calls[0][0]
      expect(data.days_waiting).to.equal(14)
      expect(data.suggested_groups.map(g => g.name)).to.include('Tool Library')
      expect(data.suggested_groups[0].url).to.match(/\/about/)
    })
  })
})
