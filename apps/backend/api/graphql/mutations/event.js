import { GraphQLError } from 'graphql'
import { values, includes } from 'lodash/fp'
import ical from 'ical-generator'

export async function respondToEvent (userId, eventId, response) {
  if (!includes(response, values(EventInvitation.RESPONSE))) {
    throw new GraphQLError(`response must be one of ${values(EventInvitation.RESPONSE)}. received ${response}`)
  }

  const event = await Post.find(eventId)
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
    const calendar = ical()
    const iCalData = await event.getCalData(userId)
    const iCalEvent = calendar.createEvent(iCalData)
    const user = await eventInvitation.user().fetch()

    Queue.classMethod('Email', 'sendEventRsvpEmail', {
      email: user.get('email'),
      version: 'default',
      data: {
        user_name: user.get('name'),
        event_name: event.title(),
        event_description: event.details(),
        event_url: event.get('location'),
        response
      },
      files: [
        {
          filename: 'invite.ics',
          content: btoa(iCalEvent.toString())
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
