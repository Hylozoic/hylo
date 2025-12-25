import { expect } from 'chai'
import { respondToEvent } from './event'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'

describe('respondToEvent', () => {
  describe('Queue.classMethod calls', () => {
    let user, event

    beforeEach(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      event = await factories.post({ type: Post.Type.EVENT }).save()
      spyify(Queue, 'classMethod', () => Promise.resolve())
    })

    afterEach(() => {
      unspyify(Queue, 'classMethod')
    })

    describe('when no existing invitation', () => {
      it('queues Post.sendUserRsvp with { new: true } and User.createRsvpCalendarSubscription when response is YES', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.YES)

        expect(Queue.classMethod).to.have.been.called.twice
        
        const eventInvitation = await EventInvitation.find({
          userId: user.id,
          eventId: event.id
        })
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { new: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })

      it('queues Post.sendUserRsvp with { new: true } and User.createRsvpCalendarSubscription when response is INTERESTED', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.INTERESTED)

        expect(Queue.classMethod).to.have.been.called.twice
        
        const eventInvitation = await EventInvitation.find({
          userId: user.id,
          eventId: event.id
        })
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { new: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })

      it('does not queue any classMethods when response is NO', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.NO)

        expect(Queue.classMethod).to.not.have.been.called
      })
    })

    describe('when existing invitation response is YES', () => {
      let eventInvitation

      beforeEach(async () => {
        eventInvitation = await EventInvitation.create({
          userId: user.id,
          eventId: event.id,
          inviterId: user.id,
          response: EventInvitation.RESPONSE.YES
        })
      })

      it('does not queue any classMethods when staying YES', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.YES)

        expect(Queue.classMethod).to.not.have.been.called
      })

      it('does not queue any classMethods when changing to INTERESTED', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.INTERESTED)

        expect(Queue.classMethod).to.not.have.been.called
      })

      it('queues Post.sendUserRsvp with { deleted: true } and User.createRsvpCalendarSubscription when changing to NO', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.NO)

        expect(Queue.classMethod).to.have.been.called.twice
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { deleted: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })
    })

    describe('when existing invitation response is INTERESTED', () => {
      let eventInvitation

      beforeEach(async () => {
        eventInvitation = await EventInvitation.create({
          userId: user.id,
          eventId: event.id,
          inviterId: user.id,
          response: EventInvitation.RESPONSE.INTERESTED
        })
      })

      it('does not queue any classMethods when changing to YES', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.YES)

        expect(Queue.classMethod).to.not.have.been.called
      })

      it('does not queue any classMethods when staying INTERESTED', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.INTERESTED)

        expect(Queue.classMethod).to.not.have.been.called
      })

      it('queues Post.sendUserRsvp with { deleted: true } and User.createRsvpCalendarSubscription when changing to NO', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.NO)

        expect(Queue.classMethod).to.have.been.called.twice
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { deleted: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })
    })

    describe('when existing invitation response is NO', () => {
      let eventInvitation

      beforeEach(async () => {
        eventInvitation = await EventInvitation.create({
          userId: user.id,
          eventId: event.id,
          inviterId: user.id,
          response: EventInvitation.RESPONSE.NO
        })
      })

      it('queues Post.sendUserRsvp with { new: true } and User.createRsvpCalendarSubscription when changing to YES', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.YES)

        expect(Queue.classMethod).to.have.been.called.twice
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { new: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })

      it('queues Post.sendUserRsvp with { new: true } and User.createRsvpCalendarSubscription when changing to INTERESTED', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.INTERESTED)

        expect(Queue.classMethod).to.have.been.called.twice
        expect(Queue.classMethod).to.have.been.called.with(
          'Post',
          'sendUserRsvp',
          {
            eventInvitationId: eventInvitation.id,
            eventChanges: { new: true }
          }
        )
        expect(Queue.classMethod).to.have.been.called.with(
          'User',
          'createRsvpCalendarSubscription',
          { userId: user.id }
        )
      })

      it('does not queue any classMethods when staying NO', async () => {
        await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.NO)

        expect(Queue.classMethod).to.not.have.been.called
      })
    })
  })

  describe('eventInvitation creation and updates', () => {
    let user, event

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      event = await factories.post({ type: Post.Type.EVENT }).save()
    })

    it('creates an eventInvitation if none exists', async () => {
      await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.YES)

      const eventInvitation = await EventInvitation.find({
        userId: user.id,
        eventId: event.id
      })
      expect(eventInvitation).to.exist
      expect(eventInvitation.get('response')).to.equal(EventInvitation.RESPONSE.YES)
    })

    it('updates an existing eventInvitation', async () => {
      await EventInvitation.create({
        userId: user.id,
        eventId: event.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })

      await respondToEvent(user.id, event.id, EventInvitation.RESPONSE.NO)

      const eventInvitation = await EventInvitation.find({
        userId: user.id,
        eventId: event.id
      })
      expect(eventInvitation).to.exist
      expect(eventInvitation.get('response')).to.equal(EventInvitation.RESPONSE.NO)
    })
  })
})
