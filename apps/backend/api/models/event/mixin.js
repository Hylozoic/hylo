import { uniq, difference } from 'lodash/fp'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import ical, { ICalEventStatus, ICalCalendarMethod } from 'ical-generator'
import { senderNameViaHylo } from '../../../lib/email/senderNameViaHylo'

function resolveEventChangeValue (eventChanges, key, currentValue) {
  if (!eventChanges || eventChanges[key] === false || eventChanges[key] === undefined) {
    return currentValue
  }
  return eventChanges[key]
}

function buildCalLocationAndDescription ({ physicalLocation, meetingLink, baseDescription }) {
  const location = physicalLocation || meetingLink || ''
  let description = baseDescription
  if (physicalLocation && meetingLink) {
    const joinLine = `Join online: ${meetingLink}`
    description = description ? `${description}\n\n${joinLine}` : joinLine
  }
  return { location, description }
}

function formatEventLocationForEmail (location, meetingLink) {
  const physical = location || ''
  const link = meetingLink || ''
  if (physical && link) return `${physical}\nJoin online: ${link}`
  return physical || link || ''
}

function resolveNewLocationForEmail (eventChanges, post) {
  const locationChanged = eventChanges?.location !== false && eventChanges?.location !== undefined
  const meetingLinkChanged = eventChanges?.meeting_link !== false && eventChanges?.meeting_link !== undefined
  if (!locationChanged && !meetingLinkChanged) return eventChanges?.location

  return formatEventLocationForEmail(
    resolveEventChangeValue(eventChanges, 'location', post.get('location')),
    resolveEventChangeValue(eventChanges, 'meeting_link', post.get('meeting_link'))
  )
}

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

  removeEventInvitees: async function ({ userIds, opts }) {
    return Promise.map(userIds, async userId => {
      const invitation = await EventInvitation.find({ userId, eventId: this.id }, opts)
      return invitation?.destroy(opts)
    })
  },

  addEventInvitees: async function ({ userIds, inviterId, opts }) {
    return Promise.map(uniq(userIds), async userId => {
      const invitation = await EventInvitation.find({ userId, eventId: this.id }, opts)
      return !invitation && EventInvitation.create({ userId, inviterId, eventId: this.id }, opts)
    })
  },

  updateEventInvitees: async function ({ eventInviteeIds = [], inviterId, opts }) {
    const existingEventInviteeIds = (await this.eventInvitations().fetch()).pluck('user_id')
    const toRemove = difference(existingEventInviteeIds, eventInviteeIds)
    const toAdd = difference(eventInviteeIds, existingEventInviteeIds)

    await this.removeEventInvitees({ userIds: toRemove, opts })
    await this.addEventInvitees({ userIds: toAdd, inviterId, opts })
  },

  getEventRsvpUserIds: async function () {
    const rsvps = await this.eventInvitations()
      .query(qb => {
        qb.select('user_id')
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

  createCalInvite: async function ({ userId, eventInvitation, eventChanges, groupName }) {
    const calEvent = await this.getCalEventData({
      eventInvitation,
      forUserId: userId,
      eventChanges,
      url: !eventChanges?.deleted && Frontend.Route.post(this, groupName)
    })

    const cal = ical()
    cal.method(calEvent.method)
    cal.createEvent(calEvent).uid(calEvent.uid)
    cal.scale('gregorian')

    return cal
  },

  // event can be new, updated or deleted
  getCalEventData: async function ({ eventInvitation, forUserId, eventChanges, url }) {
    const organizer = await this.user().fetch()
    const deleted = eventChanges?.deleted
    const newStart = eventChanges?.start_time
    const newEnd = eventChanges?.end_time
    const physicalLocation = resolveEventChangeValue(eventChanges, 'location', this.get('location'))
    const meetingLink = resolveEventChangeValue(eventChanges, 'meeting_link', this.get('meeting_link'))
    const { location, description } = buildCalLocationAndDescription({
      physicalLocation,
      meetingLink,
      baseDescription: TextHelpers.presentHTMLToText(this.details(forUserId))
    })
    // note: eventInvitation.response can be null
    const notGoing = eventInvitation?.notGoing()
    const going = eventInvitation?.going()

    return {
      summary: this.title(),
      description,
      location,
      start: newStart || this.get('start_time'),
      end: newEnd || this.get('end_time'),
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
    const nextSeq = this.getIcalSequence() + 1
    return this.save({ ical_sequence: nextSeq }, { patch: true })
  },

  createUserRsvpCalendarSubscriptions: async function () {
    const userIds = await this.getEventRsvpUserIds()
    userIds.forEach(userId => {
      Queue.classMethod('User', 'createRsvpCalendarSubscription', { userId })
    })
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
    if (!eventInvitation) return
    const user = await eventInvitation.user().fetch()
    await this.load('groups')
    const groupNames = this.relations.groups.map(g => g.get('name')).join(', ')
    const groupName = this.relations.groups.first()
    const calInvite = await this.createCalInvite({ userId: user.id, eventInvitation, eventChanges, groupName })
    const emailTemplate = eventChanges.new ? 'sendEventRsvpEmail' : eventChanges.deleted ? 'sendEventRsvpCancelEmail' : 'sendEventRsvpUpdateEmail'
    const newStart = (eventChanges.start_time || eventChanges.end_time) ? (eventChanges.start_time || this.get('start_time')) : null
    const newEnd = (eventChanges.start_time || eventChanges.end_time) ? (eventChanges.end_time || this.get('end_time')) : null
    const userLocale = user.getLocale()
    const newDate = newStart && newEnd ? DateTimeHelpers.formatDatePair({ start: newStart, end: newEnd, timezone: this.get('timezone'), locale: userLocale }) : null
    const newLocation = resolveNewLocationForEmail(eventChanges, this)

    const rsvpEmailPayload = {
      email: user.get('email'),
      version: 'default',
      data: {
        date: DateTimeHelpers.formatDatePair({ start: this.get('start_time'), end: this.get('end_time'), timezone: this.get('timezone'), locale: userLocale }),
        user_name: user.get('name'),
        event_name: this.title(),
        event_description: this.details(),
        event_location: formatEventLocationForEmail(this.get('location'), this.get('meeting_link')),
        event_url: Frontend.Route.post(this, this.relations.groups.first()),
        response: eventInvitation.getHumanResponse(),
        group_names: groupNames,
        newDate,
        newLocation
      },
      files: [
        {
          id: 'invite.ics',
          data: Buffer.from(calInvite.toString(), 'utf8').toString('base64')
        }
      ]
    }
    if (groupName) {
      rsvpEmailPayload.sender = { name: senderNameViaHylo(groupName.get('name'), user.getLocale()) }
    }
    Queue.classMethod('Email', emailTemplate, rsvpEmailPayload).then(() => {
      eventInvitation.incrementIcalSequence()
    })
  },

  sendUserRsvps: async function ({ eventChanges }) {
    const userIds = await this.getEventRsvpUserIds()
    return Promise.map(userIds, async userId => {
      const eventInvitation = await EventInvitation.find({ userId, eventId: this.id })
      return eventInvitation && this.sendUserRsvp({ eventInvitationId: eventInvitation.id, eventChanges })
    })
  }
}

/** Class methods for event-related queue jobs. Merge into Post class methods. */
export const eventClassMethods = {
  /** Fetches the event by id and delegates to instance sendUserRsvp. Used by Queue.classMethod. */
  async sendUserRsvp ({ eventId, eventInvitationId, eventChanges }) {
    const post = await Post.find(eventId)
    if (!post) return
    return post.sendUserRsvp({ eventInvitationId, eventChanges })
  }
}
