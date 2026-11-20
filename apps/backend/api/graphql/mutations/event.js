import { GraphQLError } from 'graphql'
import { values, includes } from 'lodash/fp'
import { EVENT_TYPES } from '../../../lib/analytics/trackActivity'
import { groupIdsForPost, track } from '../../../lib/analytics/track'

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
  const sendRsvp = (!wasGoing && EventInvitation.going(response)) ||
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

  if (['yes', 'interested'].includes(response)) {
    recordRsvp(userId, event, eventInvitation)
  }

  if (sendRsvp) {
    const eventChanges = (!wasGoing && EventInvitation.going(response))
      ? { new: true }
      : { deleted: true }
    Queue.classMethod('Post', 'sendUserRsvp', { eventId, eventInvitationId: eventInvitation.id, eventChanges })
    Queue.classMethod('User', 'createRsvpCalendarSubscription', { userId })
  }

  return { success: true }
}

/** Records a yes or interested RSVP. A later change of the same invitation is a new time, so it is kept. */
function recordRsvp (userId, event, invitation) {
  groupIdsForPost(event.id).then(groupIds => {
    track({
      type: EVENT_TYPES.EVENT_RSVP,
      userId,
      groupIds,
      object: { type: 'event_invitation', id: invitation.id },
      targetUserId: event.get('user_id'),
      postType: 'event',
      occurredAt: invitation.get('updated_at') || invitation.get('created_at') || new Date()
    })
  }).catch(() => {})
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
