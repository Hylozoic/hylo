import { GraphQLError } from 'graphql'

/* eslint-disable camelcase */
module.exports = bookshelf.Model.extend({
  tableName: 'event_invitations',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User, 'user_id')
  },

  inviter: function () {
    return this.belongsTo(User, 'inviter_id')
  },

  event: function () {
    return this.belongsTo(Post, 'event_id')
  },

  getIcalSequence: function () {
    return this.get('ical_sequence') || 0
  },

  incrementIcalSequence: async function () {
    return this.save({ ical_sequence: this.getIcalSequence() + 1 })
  },

  notGoing: function () {
    return this.get('response') === EventInvitation.RESPONSE.NO
  },

  going: function () {
    return EventInvitation.going(this)
  },

  getHumanResponse: function () {
    const responseMap = {
      [EventInvitation.RESPONSE.YES]: 'Going to',
      [EventInvitation.RESPONSE.NO]: 'Not Going to',
      [EventInvitation.RESPONSE.INTERESTED]: 'Interested in'
    }
    return responseMap[this.get('response')]
  }
}, {

  RESPONSE: {
    YES: 'yes',
    NO: 'no',
    INTERESTED: 'interested'
  },

  going: function (eventInvitationOrResponse) {
    const response = eventInvitationOrResponse.get?.('response') || eventInvitationOrResponse
    return response === EventInvitation.RESPONSE.YES || response === EventInvitation.RESPONSE.INTERESTED
  },

  create: function ({ userId, inviterId, eventId, response }, trxOpts) {
    if (!userId) {
      throw new GraphQLError('must provide a user_id')
    }

    if (!eventId) {
      throw new GraphQLError('must provide an event_id')
    }

    return this.find({ userId, inviterId, eventId }, trxOpts)
      .then(existing => {
        if (existing) return existing

        return new EventInvitation({
          user_id: userId,
          inviter_id: inviterId,
          event_id: eventId,
          response,
          created_at: new Date(),
          updated_at: new Date()
        })
          .save(null, trxOpts)
      })
  },

  find: function ({ userId, inviterId, eventId }, opts) {
    if (!userId) throw new GraphQLError('Parameter user_id must be supplied.')
    if (!eventId) throw new GraphQLError('Parameter event_id must be supplied.')

    const conditions = {
      user_id: userId,
      event_id: eventId
    }

    if (inviterId) conditions.inviter_id = inviterId

    return EventInvitation.where(conditions).fetch(opts)
  }
})
