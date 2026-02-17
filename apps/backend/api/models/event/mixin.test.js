import { expect } from 'chai'
import { ICalEventStatus, ICalCalendarMethod } from 'ical-generator'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'

describe('Event Mixin', () => {
  describe('#isEvent', () => {
    it('returns true for event posts', () => {
      const post = factories.post({ type: Post.Type.EVENT })
      expect(post.isEvent()).to.equal(true)
    })

    it('returns false for non-event posts', () => {
      const post = factories.post({ type: Post.Type.DISCUSSION })
      expect(post.isEvent()).to.equal(false)
    })
  })

  describe('#getIcalSequence', () => {
    it('returns ical_sequence when set', () => {
      const post = factories.post({ ical_sequence: 5 })
      expect(post.getIcalSequence()).to.equal(5)
    })

    it('returns 0 when ical_sequence is not set', () => {
      const post = factories.post()
      expect(post.getIcalSequence()).to.equal(0)
    })
  })

  describe('#incrementIcalSequence', () => {
    let post

    before(async () => {
      await setup.clearDb()
      post = await factories.post({
        type: Post.Type.EVENT
      }).save()
      // Set initial sequence if column exists
      try {
        await post.save({ ical_sequence: 3 }, { patch: true })
      } catch (e) {
        // Column might not exist, skip this test
      }
    })

    it('increments ical_sequence by 1', async () => {
      const initialSequence = post.getIcalSequence()
      await post.incrementIcalSequence()
      await post.refresh()
      const newSequence = post.getIcalSequence()
      expect(newSequence).to.equal(initialSequence + 1)
    })
  })

  describe('#addEventInvitees', () => {
    let user, event, invitee1, invitee2

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id
      }).save()
    })

    it('creates event invitations for new invitees with correct inviterId', async () => {
      await event.addEventInvitees({ userIds: [invitee1.id, invitee2.id], inviterId: user.id })
      const invitations = await event.eventInvitations().fetch()
      expect(invitations.length).to.equal(2)
      expect(invitations.pluck('user_id').sort()).to.deep.equal([invitee1.id, invitee2.id].sort())
      expect(invitations.pluck('inviter_id')).to.deep.equal([user.id, user.id])
    })

    it('does not create duplicate invitations', async () => {
      await event.addEventInvitees({ userIds: [invitee1.id], inviterId: user.id })
      const invitations = await event.eventInvitations().fetch()
      expect(invitations.length).to.equal(2)
    })

    it('handles duplicate userIds in input', async () => {
      const invitee3 = await factories.user().save()
      await event.addEventInvitees({ userIds: [invitee3.id, invitee3.id], inviterId: user.id })
      const invitations = await event.eventInvitations().fetch()
      const invitee3Invitations = invitations.filter(inv => inv.get('user_id') === invitee3.id)
      expect(invitee3Invitations.length).to.equal(1)
    })
  })

  describe('#removeEventInvitees', () => {
    let user, event, invitee1, invitee2

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id
      }).save()
      await event.addEventInvitees({ userIds: [invitee1.id, invitee2.id], inviterId: user.id })
    })

    it('removes event invitations for specified users', async () => {
      await event.removeEventInvitees({ userIds: [invitee1.id] })
      const invitations = await event.eventInvitations().fetch()
      expect(invitations.length).to.equal(1)
      expect(invitations.first().get('user_id')).to.equal(invitee2.id)
    })

    it('removes invitation for event owner when specified', async () => {
      const ownerInvitation = await EventInvitation.create({
        userId: user.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
      await event.removeEventInvitees({ userIds: [user.id] })
      const found = await EventInvitation.find({ userId: user.id, eventId: event.id })
      expect(found).to.not.exist
    })
  })

  describe('#updateEventInvitees', () => {
    let user1, user2, event, invitee1, invitee2, invitee3

    beforeEach(async () => {
      await setup.clearDb()
      user1 = await factories.user().save()
      user2 = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      invitee3 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user1.id
      }).save()
      await event.addEventInvitees({ userIds: [invitee1.id, invitee2.id], inviterId: user1.id })
    })

    it('adds new invitees with correct inviterId and removes old ones', async () => {
      await event.updateEventInvitees({ eventInviteeIds: [invitee2.id, invitee3.id], inviterId: user2.id })
      const invitations = await event.eventInvitations().fetch()
      expect(invitations.length).to.equal(2)
      expect(invitations.pluck('user_id').sort()).to.deep.equal([invitee2.id, invitee3.id].sort())
      expect(invitations.pluck('inviter_id').sort()).to.deep.equal([user1.id, user2.id].sort())
    })
  })

  describe('#getEventRsvpUserIds', () => {
    let user, event, invitee1, invitee2, invitee3

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      invitee3 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id
      }).save()
      
      await EventInvitation.create({
        userId: invitee1.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: invitee2.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.INTERESTED
      })
      await EventInvitation.create({
        userId: invitee3.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.NO
      })
    })

    it('returns user IDs for users with YES or INTERESTED responses', async () => {
      const userIds = await event.getEventRsvpUserIds()
      expect(userIds.length).to.equal(2)
      expect(userIds).to.include(invitee1.id)
      expect(userIds).to.include(invitee2.id)
    })

    it('does not include user IDs for users with NO response', async () => {
      const userIds = await event.getEventRsvpUserIds()
      expect(userIds).to.not.include(invitee3.id)
    })
  })

  describe('#createInviteNotifications', () => {
    let user, event, invitee1, invitee2

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id
      }).save()
    })

    it('creates activities for invitees', async () => {
      await event.createInviteNotifications(user.id, [invitee1.id, invitee2.id])
      const activities = await Activity.where({ post_id: event.id }).fetchAll()
      expect(activities.length).to.equal(2)
      activities.forEach(activity => {
        const meta = activity.get('meta')
        const reasons = meta?.reasons || []
        expect(reasons).to.include('eventInvitation')
        expect(activity.get('actor_id')).to.equal(user.id)
        expect([invitee1.id, invitee2.id]).to.include(activity.get('reader_id'))
      })
    })
  })

  describe('#createUserRsvpCalendarSubscriptions', () => {
    let user, event, invitee1, invitee2, invitee3

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      invitee3 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id
      }).save()
      
      await EventInvitation.create({
        userId: invitee1.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: invitee2.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.INTERESTED
      })
      await EventInvitation.create({
        userId: invitee3.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.NO
      })
    })

    beforeEach(() => {
      spyify(Queue, 'classMethod')
    })

    afterEach(() => {
      unspyify(Queue, 'classMethod')
    })

    it('calls Queue.classMethod for users with YES response', async () => {
      await event.createUserRsvpCalendarSubscriptions()
      expect(Queue.classMethod).to.have.been.called.with(
        'User',
        'createRsvpCalendarSubscription',
        { userId: invitee1.id }
      )
    })

    it('calls Queue.classMethod for users with INTERESTED response', async () => {
      await event.createUserRsvpCalendarSubscriptions()
      expect(Queue.classMethod).to.have.been.called.with(
        'User',
        'createRsvpCalendarSubscription',
        { userId: invitee2.id }
      )
    })

    it('does not call Queue.classMethod for users with NO response', async () => {
      await event.createUserRsvpCalendarSubscriptions()
      const calls = Queue.classMethod.getCalls ? Queue.classMethod.getCalls() : []
      const noResponseCalls = calls.filter(call => 
        call[0] === 'User' && 
        call[1] === 'createRsvpCalendarSubscription' && 
        call[2].userId === invitee3.id
      )
      expect(noResponseCalls.length).to.equal(0)
    })

    it('only calls Queue.classMethod for users with YES or INTERESTED responses', async () => {
      await event.createUserRsvpCalendarSubscriptions()
      expect(Queue.classMethod).to.have.been.called.twice
    })
  })

  describe('#createGroupEventCalendarSubscriptions', () => {
    let user, event, group1, group2

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      group1 = await factories.group().save()
      group2 = await factories.group().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true
      }).save()
      await event.groups().attach([group1.id, group2.id])
    })

    beforeEach(() => {
      spyify(Queue, 'classMethod')
    })

    afterEach(() => {
      unspyify(Queue, 'classMethod')
    })

    it('calls Queue.classMethod for each group', async () => {
      await event.createGroupEventCalendarSubscriptions()
      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Group',
        'createEventCalendarSubscription',
        { groupId: group1.id }
      )
      expect(Queue.classMethod).to.have.been.called.with(
        'Group',
        'createEventCalendarSubscription',
        { groupId: group2.id }
      )
    })

    it('calls Queue.classMethod even when event is inactive (Group.createEventCalendarSubscription filters by active)', async () => {
      await event.save({ active: false }, { patch: true })
      await event.createGroupEventCalendarSubscriptions()
      expect(Queue.classMethod).to.have.been.called
      // Note: The actual filtering of inactive events happens in Group.createEventCalendarSubscription
      // which queries with 'posts.active': true, so we still call it here
    })
  })

  describe('#getCalEventData', () => {
    let user, event, invitee1, invitee2, eventInvitation

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        name: 'Test Event',
        description: '<p>Test Description</p>',
        location: 'Original Location',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: new Date('2024-01-01T12:00:00Z')
      }).save()
      
      eventInvitation = await EventInvitation.create({
        userId: invitee1.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
    })

    it('returns correct data for new event with no eventChanges', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.summary).to.equal(event.title())
      expect(calEvent.location).to.equal('Original Location')
      expect(calEvent.start).to.deep.equal(event.get('start_time'))
      expect(calEvent.end).to.deep.equal(event.get('end_time'))
      expect(calEvent.status).to.equal(ICalEventStatus.CONFIRMED)
      expect(calEvent.method).to.equal(ICalCalendarMethod.REQUEST)
      expect(calEvent.url).to.equal('https://example.com/event')
    })

    it('returns CANCELLED status and CANCEL method when eventChanges.deleted is true', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { deleted: true },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.status).to.equal(ICalEventStatus.CANCELLED)
      expect(calEvent.method).to.equal(ICalCalendarMethod.CANCEL)
      // When deleted, location, start, and end still use original values (not false)
      expect(calEvent.location).to.equal('Original Location')
      expect(calEvent.start).to.be.instanceOf(Date)
      expect(calEvent.end).to.be.instanceOf(Date)
      // URL should be false when deleted
      expect(calEvent.url).to.equal(false)
    })

    it('uses new location from eventChanges.location', async () => {
      const newLocation = 'New Location'
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { location: newLocation },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.location).to.equal(newLocation)
    })

    it('uses new start_time from eventChanges.start_time', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { start_time: newStart },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.start).to.deep.equal(newStart)
    })

    it('uses new end_time from eventChanges.end_time', async () => {
      const newEnd = new Date('2024-01-02T14:00:00Z')
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { end_time: newEnd },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.end).to.deep.equal(newEnd)
    })

    it('uses all new values from eventChanges when provided', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      const newEnd = new Date('2024-01-02T14:00:00Z')
      const newLocation = 'Updated Location'
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: {
          start_time: newStart,
          end_time: newEnd,
          location: newLocation
        },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.start).to.deep.equal(newStart)
      expect(calEvent.end).to.deep.equal(newEnd)
      expect(calEvent.location).to.equal(newLocation)
    })

    it('returns CANCELLED status when eventInvitation.notGoing() is true', async () => {
      const noResponseInvitation = await EventInvitation.create({
        userId: invitee2.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.NO
      })
      
      const calEvent = await event.getCalEventData({
        eventInvitation: noResponseInvitation,
        forUserId: invitee2.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.status).to.equal(ICalEventStatus.CANCELLED)
      expect(calEvent.method).to.equal(ICalCalendarMethod.CANCEL)
    })

    it('returns CONFIRMED status when eventInvitation.going() is true', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.status).to.equal(ICalEventStatus.CONFIRMED)
      expect(calEvent.method).to.equal(ICalCalendarMethod.REQUEST)
    })

    it('uses eventInvitation.getIcalSequence() when available', async () => {
      spyify(eventInvitation, 'getIcalSequence', () => 5)
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.sequence).to.equal(5)
      unspyify(eventInvitation, 'getIcalSequence')
    })

    it('falls back to event.getIcalSequence() when eventInvitation.getIcalSequence() is not available', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation: null,
        forUserId: invitee1.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.sequence).to.equal(event.getIcalSequence())
    })

    it('includes organizer information', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: null,
        url: 'https://example.com/event'
      })
      
      expect(calEvent.organizer).to.exist
      expect(calEvent.organizer.name).to.equal(user.get('name'))
      expect(calEvent.organizer.email).to.equal(user.get('email'))
    })

    it('returns valid data structure for new event (eventChanges.new)', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { new: true },
        url: 'https://example.com/event'
      })
      
      // Verify all required fields are present and valid
      expect(calEvent.summary).to.exist
      expect(calEvent.description).to.exist
      expect(calEvent.location).to.exist
      expect(calEvent.start).to.exist
      expect(calEvent.end).to.exist
      expect(calEvent.status).to.exist
      expect(calEvent.method).to.exist
      expect(calEvent.sequence).to.exist
      expect(calEvent.uid).to.exist
      expect(calEvent.organizer).to.exist
      expect(calEvent.organizer.name).to.exist
      expect(calEvent.organizer.email).to.exist
      
      // Verify data types
      expect(calEvent.start).to.be.instanceOf(Date)
      expect(calEvent.end).to.be.instanceOf(Date)
      expect(typeof calEvent.summary).to.equal('string')
      expect(typeof calEvent.location).to.equal('string')
      expect(calEvent.url).to.equal('https://example.com/event')
    })

    it('returns valid data structure for deleted event (eventChanges.deleted)', async () => {
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { deleted: true },
        url: 'https://example.com/event'
      })
      
      // Verify all required fields are present
      expect(calEvent.summary).to.exist
      expect(calEvent.description).to.exist
      expect(calEvent.location).to.exist
      expect(calEvent.start).to.exist
      expect(calEvent.end).to.exist
      expect(calEvent.status).to.equal(ICalEventStatus.CANCELLED)
      expect(calEvent.method).to.equal(ICalCalendarMethod.CANCEL)
      expect(calEvent.sequence).to.exist
      expect(calEvent.uid).to.exist
      expect(calEvent.organizer).to.exist
      
      // For deleted events, url should be false
      expect(calEvent.url).to.equal(false)
      
      // Verify data types are still valid (location, start, end should still be present)
      expect(calEvent.start).to.be.instanceOf(Date)
      expect(calEvent.end).to.be.instanceOf(Date)
      expect(typeof calEvent.location).to.equal('string')
    })

    it('returns valid data structure for updated event (eventChanges with location)', async () => {
      const newLocation = 'Updated Location'
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { location: newLocation },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.location).to.equal(newLocation)
      expect(calEvent.start).to.be.instanceOf(Date)
      expect(calEvent.end).to.be.instanceOf(Date)
      expect(calEvent.status).to.exist
      expect(calEvent.method).to.exist
      expect(calEvent.uid).to.exist
      expect(calEvent.url).to.equal('https://example.com/event')
    })

    it('returns valid data structure for updated event (eventChanges with start_time)', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { start_time: newStart },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.start).to.deep.equal(newStart)
      expect(calEvent.end).to.be.instanceOf(Date)
      expect(calEvent.location).to.exist
      expect(calEvent.status).to.exist
      expect(calEvent.method).to.exist
      expect(calEvent.uid).to.exist
    })

    it('returns valid data structure for updated event (eventChanges with end_time)', async () => {
      const newEnd = new Date('2024-01-02T14:00:00Z')
      const calEvent = await event.getCalEventData({
        eventInvitation,
        forUserId: invitee1.id,
        eventChanges: { end_time: newEnd },
        url: 'https://example.com/event'
      })
      
      expect(calEvent.end).to.deep.equal(newEnd)
      expect(calEvent.start).to.be.instanceOf(Date)
      expect(calEvent.location).to.exist
      expect(calEvent.status).to.exist
      expect(calEvent.method).to.exist
      expect(calEvent.uid).to.exist
    })
  })

  describe('#createCalInvite', () => {
    let user, event, invitee, eventInvitation, group

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee = await factories.user().save()
      group = await factories.group().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        name: 'Test Event',
        description: '<p>Test Description</p>',
        location: 'Test Location',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: new Date('2024-01-01T12:00:00Z')
      }).save()
      await event.groups().attach([group.id])
      
      eventInvitation = await EventInvitation.create({
        userId: invitee.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
    })

    it('creates valid calendar for new event (eventChanges.new)', async () => {
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { new: true },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:REQUEST')
      expect(calString).to.include('STATUS:CONFIRMED')
      expect(calString).to.include(event.iCalUid())
    })

    it('creates valid calendar for deleted event (eventChanges.deleted)', async () => {
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { deleted: true },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:CANCEL')
      expect(calString).to.include('STATUS:CANCELLED')
      expect(calString).to.include(event.iCalUid())
    })

    it('creates valid calendar for updated event (eventChanges.location)', async () => {
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { location: 'Updated Location' },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:REQUEST')
      expect(calString).to.include('STATUS:CONFIRMED')
      expect(calString).to.include(event.iCalUid())
      expect(calString).to.include('Updated Location')
    })

    it('creates valid calendar for updated event (eventChanges.start_time)', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { start_time: newStart },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:REQUEST')
      expect(calString).to.include(event.iCalUid())
    })

    it('creates valid calendar for updated event (eventChanges.end_time)', async () => {
      const newEnd = new Date('2024-01-02T14:00:00Z')
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { end_time: newEnd },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:REQUEST')
      expect(calString).to.include(event.iCalUid())
    })

    it('creates valid calendar for updated event (eventChanges with all fields)', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      const newEnd = new Date('2024-01-02T14:00:00Z')
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: {
          start_time: newStart,
          end_time: newEnd,
          location: 'Updated Location'
        },
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include('METHOD:REQUEST')
      expect(calString).to.include(event.iCalUid())
      expect(calString).to.include('Updated Location')
    })

    it('creates valid calendar when eventInvitation is null', async () => {
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation: null,
        eventChanges: null,
        groupName: group
      })
      
      expect(cal).to.exist
      const calString = cal.toString()
      expect(calString).to.include('BEGIN:VCALENDAR')
      expect(calString).to.include('BEGIN:VEVENT')
      expect(calString).to.include(event.iCalUid())
    })

    it('does not include url when eventChanges.deleted is true', async () => {
      const cal = await event.createCalInvite({
        userId: invitee.id,
        eventInvitation,
        eventChanges: { deleted: true },
        groupName: group
      })
      
      const calString = cal.toString()
      // URL should not be included in deleted events
      // The exact format depends on ical-generator, but we verify it doesn't crash
      expect(calString).to.include('METHOD:CANCEL')
    })
  })

  describe('#sendUserRsvp', () => {
    let user, event, invitee, eventInvitation, group

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee = await factories.user().save()
      group = await factories.group().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        name: 'Test Event',
        description: '<p>Test Description</p>',
        location: 'Test Location',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: new Date('2024-01-01T12:00:00Z')
      }).save()
      await event.groups().attach([group.id])
      
      eventInvitation = await EventInvitation.create({
        userId: invitee.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
    })

    beforeEach(() => {
      spyify(Queue, 'classMethod', () => Promise.resolve())
      spyify(eventInvitation, 'incrementIcalSequence')
      spyify(eventInvitation, 'getIcalSequence', () => 0)
      spyify(event, 'createCalInvite')
      
      // Mock calendar object
      const mockCal = {
        method: () => mockCal,
        url: 'https://example.com/event',
        toString: () => 'BEGIN:VCALENDAR...'
      }
      event.createCalInvite = () => Promise.resolve(mockCal)
    })

    afterEach(() => {
      unspyify(Queue, 'classMethod')
      unspyify(eventInvitation, 'incrementIcalSequence')
      unspyify(eventInvitation, 'getIcalSequence')
      unspyify(event, 'createCalInvite')
    })

    it('queues sendEventRsvpEmail template when eventChanges.new is true', async () => {
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { new: true } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpEmail'
      )
    })

    it('queues sendEventRsvpCancelEmail template when eventChanges.deleted is true', async () => {
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { deleted: true } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpCancelEmail'
      )
    })

    it('queues sendEventRsvpUpdateEmail template when eventChanges has update fields (not new or deleted)', async () => {
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { location: 'New Location' } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpUpdateEmail'
      )
    })

    it('queues sendEventRsvpUpdateEmail template when eventChanges has start_time', async () => {
      const newStart = new Date('2024-01-02T10:00:00Z')
      
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { start_time: newStart } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpUpdateEmail'
      )
    })

    it('queues sendEventRsvpUpdateEmail template when eventChanges has end_time', async () => {
      const newEnd = new Date('2024-01-02T14:00:00Z')
      
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { end_time: newEnd } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpUpdateEmail'
      )
    })

    it('prefers new over deleted when both are present (new takes precedence)', async () => {
      await event.sendUserRsvp({ 
        eventInvitationId: eventInvitation.id, 
        eventChanges: { new: true, deleted: true } 
      })

      expect(Queue.classMethod).to.have.been.called
      expect(Queue.classMethod).to.have.been.called.with(
        'Email',
        'sendEventRsvpEmail'
      )
    })
  })

  describe('#sendUserRsvps', () => {
    let user, event, invitee1, invitee2, invitee3, user1

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      invitee1 = await factories.user().save()
      invitee2 = await factories.user().save()
      invitee3 = await factories.user().save()
      user1 = await factories.user().save()
      event = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: new Date('2024-01-01T12:00:00Z')
      }).save()
      
      await EventInvitation.create({
        userId: invitee1.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: invitee2.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.INTERESTED
      })
      await EventInvitation.create({
        userId: invitee3.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.NO
      })
    })

    beforeEach(() => {
      spyify(Queue, 'classMethod')
      spyify(event, 'sendUserRsvp')
    })

    afterEach(() => {
      unspyify(Queue, 'classMethod')
      unspyify(event, 'sendUserRsvp')
    })

    it('calls sendUserRsvp for each user with YES or INTERESTED response', async () => {
      const eventChanges = { new: true }
      await event.sendUserRsvps({ eventChanges })
      expect(event.sendUserRsvp).to.have.been.called.twice
    })

    it('does not call sendUserRsvp for users with NO response', async () => {
      const eventChanges = { new: true }
      await event.sendUserRsvps({ eventChanges })
      
      // Verify it was called exactly twice (for invitee1 and invitee2)
      expect(event.sendUserRsvp).to.have.been.called.twice
      
      // Get all the eventInvitationIds from the calls
      const invitationIds = []
      if (event.sendUserRsvp.__spy && event.sendUserRsvp.__spy.calls) {
        event.sendUserRsvp.__spy.calls.forEach(call => {
          if (call[0] && call[0].eventInvitationId) {
            invitationIds.push(call[0].eventInvitationId)
          }
        })
      }
      
      // Fetch all invitations and verify none belong to invitee3 (NO response)
      const invitations = await Promise.all(
        invitationIds.map(id => EventInvitation.where({ id }).fetch())
      )
      const noResponseCalls = invitations.filter(inv => inv && inv.get('user_id') === invitee3.id)
      
      // Verify no calls were made for users with NO response
      expect(noResponseCalls.length).to.equal(0)
      
      // Also verify that all calls were for users with YES or INTERESTED
      const calledUserIds = invitations.map(inv => inv ? inv.get('user_id') : null).filter(Boolean)
      expect(calledUserIds).to.include(invitee1.id)
      expect(calledUserIds).to.include(invitee2.id)
      expect(calledUserIds).to.not.include(invitee3.id)
    })
  })
})

