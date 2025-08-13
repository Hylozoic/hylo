import { GraphQLError } from 'graphql'
import { values, includes } from 'lodash/fp'
import { DateTimeHelpers } from '@hylo/shared'

export async function respondToEvent (userId, eventId, response) {
  if (!includes(response, values(EventInvitation.RESPONSE))) {
    throw new GraphQLError(`response must be one of ${values(EventInvitation.RESPONSE)}. received ${response}`)
  }

  const event = await Post.find(eventId, { withRelated: ['user', 'groups'] })
  if (!event) {
    throw new GraphQLError('Event not found')
  }

  let eventInvitation = await EventInvitation.find({ userId, eventId })
  const sendEmail = (!eventInvitation && EventInvitation.going(response)) ||
    (eventInvitation && EventInvitation.going(response) && !EventInvitation.going(eventInvitation)) ||
    (eventInvitation && !EventInvitation.going(response) && EventInvitation.going(eventInvitation))

  if (eventInvitation) {
    await eventInvitation.save({ response })
  } else {
    eventInvitation = await EventInvitation.create({
      userId,
      inviterId: userId, // why is the user who is responding also the inviter? Is this a workaround?
      eventId,
      response
    })
  }

  if (sendEmail) {
    await event.sendEventRsvpEmail(eventInvitation)
  }

  return { success: true }
}

export async function invitePeopleToEvent (userId, eventId, inviteeIds) {
  inviteeIds.forEach(async inviteeId => {
    const eventInvitation = await EventInvitation.find({ userId: inviteeId, eventId })
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
