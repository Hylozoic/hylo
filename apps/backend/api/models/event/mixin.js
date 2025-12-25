import { uniq, difference } from 'lodash/fp'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import ical, { ICalEventStatus, ICalCalendarMethod } from 'ical-generator'

export default {
  isEvent () {
    return this.get('type') === Post.Type.EVENT
  },

  eventInvitees: function () {
    return this.isEvent()
      ? this.belongsToMany(User).through(EventInvitation, 'event_id', 'user_id').withPivot('response')
      : false
  },

  eventInvitations: function () {
    return this.isEvent() ? this.hasMany(EventInvitation, 'event_id') : false
  },

  userEventInvitation: function (userId) {
    return this.eventInvitations().query({ where: { user_id: userId } }).fetchOne()
  },

  removeEventInvitees: async function (userIds, opts) {
    const eventId = this.id
    // keep the event owner invitation for rsvp emails
      userIds = userIds.filter(userId => userId !== this.get('user_id'))

    return Promise.map(userIds, async userId => {
      const invitation = await EventInvitation.find({ userId, eventId })
      return invitation?.destroy(opts)
    })
  },

  addEventInvitees: async function (userIds, opts) {
    const eventId = this.id
    const inviterId = this.get('user_id')

    return Promise.map(uniq(userIds), async userId => {
      const invitation = await EventInvitation.find({ userId, eventId })
      return !invitation && EventInvitation.create({ userId, inviterId, eventId }, opts)
    })
  },

  updateEventInvitees: async function ({ eventInviteeIds = [], opts }) {
    const existingEventInviteeIds = (await this.eventInvitations().fetch()).pluck('user_id')
    const toRemove = difference(existingEventInviteeIds, eventInviteeIds)
    const toAdd = difference(eventInviteeIds, existingEventInviteeIds)

    await this.removeEventInvitees(toRemove, opts)
    await this.addEventInvitees(toAdd, opts)
  },

  getEventInviteeRsvpIds: async function () {
    const rsvps = await this.eventInvitations()
      .query(qb => {
        qb.whereIn('response', [
          EventInvitation.RESPONSE.YES,
          EventInvitation.RESPONSE.INTERESTED
        ])
      })
      .fetch()
    return rsvps.pluck('user_id')
  },

  createInviteNotifications: async function (userId, inviteeIds) {
    const invitees = inviteeIds.map(inviteeId => ({
      reader_id: inviteeId,
      post_id: this.id,
      actor_id: userId,
      reason: 'eventInvitation'
    }))
    return Activity.saveForReasons(invitees)
  },

  createCal: async function({ userId, eventInvitation, eventChanges, groupName }) {
    const calEvent = await this.getCalEventData({ 
      eventInvitation, 
      forUserId: userId, 
      eventChanges: eventChanges, 
      url: !eventChanges?.deleted && Frontend.Route.post(this, groupName)
    })
    
    const cal = ical()
    cal.method(calEvent.method)
    cal.createEvent(calEvent).uid(calEvent.uid)
    
    return cal
  },

  // event can be new, updated or deleted
  getCalEventData: async function ({ eventInvitation, forUserId, eventChanges, url }) {
    const organizer = await this.user().fetch()
    const deleted = eventChanges?.deleted
    const newLocation = eventChanges?.location
    const newStart = eventChanges?.start_time
    const newEnd = eventChanges?.end_time
    // note: eventInvitation.response can be null
    const notGoing = eventInvitation?.notGoing()
    const going = eventInvitation?.going()
    
    return {
      summary: this.title(),
      description: TextHelpers.presentHTMLToText(this.details(forUserId)),
      location: !deleted && (newLocation || this.get('location')),
      start: !deleted && (newStart || this.get('start_time')),
      end: !deleted && (newEnd || this.get('end_time')),
      // see https://github.com/sebbo2002/ical-generator#-date-time--timezones
      // timezone: this.get('timezone'), // recommendation is to use UTC as much as possible
      status: deleted || notGoing ? ICalEventStatus.CANCELLED : going && ICalEventStatus.CONFIRMED,
      method: deleted || notGoing ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST,
      sequence: eventInvitation?.getIcalSequence() || this.getIcalSequence(),
      uid: this.iCalUid(),
      url: !deleted && url,
      organizer: {
        name: organizer.get('name'),
        email: organizer.get('email')
      }
    }
  },

  getIcalSequence: function () {
    return this.get('ical_sequence') || 0
  },

  incrementIcalSequence: async function () {
    this.save({ ical_sequence: this.getIcalSequence() + 1 })
  },

  createUserRsvpCalendarSubscriptions: async function () {
    const userIds = await this.getEventInviteeRsvpIds()
    userIds.forEach(userId => createUserRsvpCalendarSubscription({ userId }))
  },

  createUserRsvpCalendarSubscription: async function ({ userId }) {
    Queue.classMethod('User', 'createRsvpCalendarSubscription', { userId })
  },

  createGroupEventCalendarSubscriptions: async function () {
    const groupIds = (await this.groups().fetch()).pluck('id')
    groupIds.forEach(groupId => {
      Queue.classMethod('Group', 'createEventCalendarSubscription', { groupId })
    })
  },

  // event can be new, updated or deleted
  sendUserRsvp: async function ({ eventInvitationId, eventChanges }) {
    const eventInvitation = await EventInvitation.where({ id: eventInvitationId }).fetch()
    const user = await eventInvitation.user().fetch()
    await this.load('groups')
    const groupNames = this.relations.groups.map(g => g.get('name')).join(', ')
    const groupName = this.relations.groups.first()
    const cal = await this.createCal({ userId: user.id, eventInvitation, eventChanges, groupName })
    const emailTemplate = eventChanges.new ? 'sendEventRsvpEmail' :
      eventChanges.deleted ? 'sendEventRsvpCancelEmail' :
      'sendEventRsvpUpdateEmail'
    const newStart = (eventChanges.start_time || eventChanges.end_time) ? (eventChanges.start_time || this.get('start_time')) : null
    const newEnd = (eventChanges.start_time || eventChanges.end_time) ? (eventChanges.end_time || this.get('end_time')) : null
    const newDate = newStart && newEnd ? DateTimeHelpers.formatDatePair({start: newStart, end: newEnd, timezone: this.get('timezone')}) : null
    const newLocation = eventChanges.location

    Queue.classMethod('Email', emailTemplate, {
      email: user.get('email'),
      version: 'default',
      data: {
        date: DateTimeHelpers.formatDatePair({start: this.get('start_time'), end: this.get('end_time'), timezone: this.get('timezone')}),
        user_name: user.get('name'),
        event_name: this.title(),
        event_description: this.details(),
        event_location: this.get('location'),
        event_url: cal.url,
        response: eventInvitation.getHumanResponse(),
        group_names: groupNames,
        newDate: newDate,
        newLocation: newLocation
      },
      files: [
        {
          id: 'invite.ics',
          data: Buffer.from(cal.toString(), 'utf8').toString('base64')
        }
      ]
    }).then(() => {
      eventInvitation.incrementIcalSequence()
    })
  },

  sendUserRsvps: async function ({ eventChanges }) {
    const userIds = await this.getEventInviteeRsvpIds()
    return Promise.map(userIds, async userId => {
      const eventInvitation = await EventInvitation.find({ userId, eventId: this.id })
      if (eventInvitation) {
        return this.sendUserRsvp({ eventInvitationId: eventInvitation.id, eventChanges })
      }
    })
  }
}
