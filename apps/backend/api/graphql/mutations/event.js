import { GraphQLError } from 'graphql'
import ical from 'ical-generator'
import { values, includes } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'

export async function respondToEvent (userId, eventId, response) {
  if (!includes(response, values(EventInvitation.RESPONSE))) {
    throw new GraphQLError(`response must be one of ${values(EventInvitation.RESPONSE)}. received ${response}`)
  }

  const event = await Post.find(eventId, { withRelated: ['user', 'groups'] })
  if (!event) {
    throw new GraphQLError('Event not found')
  }

  const eventInvitation = await EventInvitation.find({ userId, eventId })
  if (eventInvitation) {
    await eventInvitation.save({ response })
  } else {
    await EventInvitation.create({
      userId,
      inviterId: userId, // why is the user who is responding also the inviter? Is this a workaround?
      eventId,
      response
    })
  }

  if (response === EventInvitation.RESPONSE.YES ||
    response === EventInvitation.RESPONSE.INTERESTED
  ) {
    const cal = ical()
    cal.createEvent(event.getCalEventData(userId))
    const user = await User.find(userId)
    const groupNames = event.relations.groups.map(g => g.get('name')).join(', ')

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'event_rsvp',
      cti: userId
    }).toString()

    Queue.classMethod('Email', 'sendEventRsvpEmail', {
      email: user.get('email'),
      version: 'default',
      data: {
        date: TextHelpers.formatDatePair(event.get('start_time'), event.get('end_time'), false, event.get('timezone')),
        user_name: user.get('name'),
        event_name: event.title(),
        event_description: event.details(),
        event_location: event.get('location'),
        event_url: Frontend.Route.post(event, event.relations.groups.first(), clickthroughParams),
        response: EventInvitation.getHumanResponse(response),
        group_names: groupNames
      },
      files: [
        {
          id: 'invite.ics',
          data: btoa(cal.toString())
        }
      ]
    })
  }

  return { success: true }
}

export async function invitePeopleToEvent (userId, eventId, inviteeIds) {
  inviteeIds.forEach(async inviteeId => {
    let eventInvitation = await EventInvitation.find({ userId: inviteeId, eventId })
    if (!eventInvitation) {
      await EventInvitation.create({
        userId: inviteeId,
        inviterId: userId,
        eventId
      })
    }
  })

  const event = await Post.find(eventId)

  await event.createInviteNotifications(userId, inviteeIds)

  return event
}
