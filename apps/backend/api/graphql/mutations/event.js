import { GraphQLError } from 'graphql'
import { values, includes } from 'lodash/fp'

export async function respondToEvent (userId, eventId, response) {
  if (!includes(response, values(EventInvitation.RESPONSE))) {
    throw new GraphQLError(`response must be one of ${values(EventInvitation.RESPONSE)}. received ${response}`)
  }

  const event = await Post.find(eventId)
  if (!event) {
    throw new GraphQLError('Event not found')
  }

  let eventInvitation = await EventInvitation.find({ userId, eventId })
  // determine if we send an rsvp email before updating eventInvitation
  // note: send even if user enabled subscription - they may not be using the subscription feature
  const sendRsvp = (!eventInvitation?.going() && EventInvitation.going(response)) ||
    (eventInvitation?.going() && !EventInvitation.going(response))

  if (eventInvitation) {
    await eventInvitation.save({ response })
  } else {
    eventInvitation = await EventInvitation.create({
      userId,
      eventId,
      inviterId: userId, // the user responding without invitation is inviting themselves
      response
    })
  }

  if (sendEmail) {
    Queue.classMethod('Post', 'sendEventRsvp', { eventId, eventInvitationId: eventInvitation.id })
    Queue.classMethod('Post', 'updatePostRsvpCalendarSubscriptions', { postId: eventId })
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
