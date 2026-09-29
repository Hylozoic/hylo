import { GraphQLError } from 'graphql'
import { values, includes } from 'lodash/fp'
import { inBackground, notifyRsvp } from '../../models/notification/socialNotices'

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
  const wasGoing = eventInvitation?.going()
  const becameGoing = !wasGoing && EventInvitation.going(response)
  const sendRsvp = becameGoing ||
    (wasGoing && !EventInvitation.going(response))

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

  if (sendRsvp) {
    const eventChanges = (!wasGoing && EventInvitation.going(response))
      ? { new: true }
      : { deleted: true }
    Queue.classMethod('Post', 'sendUserRsvp', { eventId, eventInvitationId: eventInvitation.id, eventChanges })
    Queue.classMethod('User', 'createRsvpCalendarSubscription', { userId })
  }

  // D45: tell the host, grouped per event (the host's own RSVP notifies no one)
  if (becameGoing) inBackground(notifyRsvp({ event, userId, response }))

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
