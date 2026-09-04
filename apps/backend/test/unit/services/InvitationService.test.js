/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify } = require(root('test/setup/helpers'))
const InvitationService = require(root('api/services/InvitationService'))

describe('InvitationService', () => {
  let group, inviter, invitee, invitation

  before(() => {
    inviter = factories.user()
    invitee = factories.user()
    group = factories.group()
    return Promise.join(inviter.save(), invitee.save(), group.save())
  })

  describe('check', () => {
    before(() => {
      invitation = factories.invitation()
      return invitation.save({
        invited_by_id: inviter.id,
        group_id: group.id
      })
    })

    it('should find a group by a valid accessCode', () => {
      return InvitationService.check(null, group.get('access_code'))
        .then(result => {
          expect(result.valid).to.equal(true)
          expect(result.isSpace).to.equal(false)
          expect(result.parentGroupSlug).to.equal(null)
        })
    })

    it('includes parent group fields for a space access code', async () => {
      const parent = await factories.group({ name: 'Parent Group' }).save()
      const space = await factories.group({
        type: 'space',
        parent_id: parent.id,
        name: 'The Space'
      }).save()
      const result = await InvitationService.check(null, space.get('access_code'))
      expect(result.valid).to.equal(true)
      expect(result.isSpace).to.equal(true)
      expect(result.groupName).to.equal('The Space')
      expect(result.parentGroupSlug).to.equal(parent.get('slug'))
      expect(result.parentGroupName).to.equal('Parent Group')
    })

    it('should find a group by a valid token', () => {
      const token = invitation.get('token')
      return InvitationService.check(token, null)
        .then(result =>
          expect(result.valid).to.equal(true)
        )
    })

    it('should find a group by accessCode if both an accessCode and token are provided', () => {
      const accessCode = group.get('access_code')
      const token = 'INVALIDTOKEN'
      InvitationService.check(token, accessCode).then(result =>
        expect(result.valid).to.equal(true)
      )
    })

    it('should not be valid if accessCode is invalid, even if token is valid', () => {
      const token = invitation.get('token')
      const accessCode = 'badaccesscode'
      return InvitationService.check(token, accessCode)
        .then(result =>
          expect(result.valid).to.equal(false)
        )
    })
  })

  describe('use', function () {
    before(function () {
      invitation = factories.invitation()
      return invitation.save({
        invited_by_id: inviter.get('id'),
        group_id: group.get('id')
      })
    })

    it('should join the invitee to group if access_code is valid', function () {
      const accessCode = group.get('access_code')
      return InvitationService.use(invitee.get('id'), null, accessCode)
        .then(membership =>
          expect(membership.attributes).to.contain({
            user_id: invitee.get('id'),
            active: true
          })
        )
    })

    it('should join the invitee to group if token is valid', function () {
      const userId = invitee.get('id')
      const token = invitation.get('token')
      return InvitationService.use(userId, token, null)
        .then(membership =>
          expect(membership.attributes).to.contain({
            user_id: invitee.get('id'),
            active: true
          })
        )
    })

    it('should join the invitee to group by accessCode if both an accessCode and token are provided', function () {
      const userId = invitee.get('id')
      const token = invitation.get('token')
      const accessCode = group.get('access_code')
      return InvitationService.use(userId, token, accessCode)
        .then(membership => {
          return invitation.refresh()
            .then(updatedInvitation => {
              expect(updatedInvitation.get('used_by_id')).to.equal(invitee.get('id'))
              return expect(membership.attributes).to.contain({
                user_id: invitee.get('id'),
                active: true
              })
            })
        })
    })
  })

  describe('create', () => {
    const queuedCalls = []
    const subject = 'Join us'
    const message = "You'll like it. It's safe."

    before(() => {
      mockify(Queue, 'classMethod', (cls, method, opts) =>
        Promise.resolve(queuedCalls.push([cls, method, opts])))
    })

    it.skip('rejects invalid emails and sends to the rest', () => {
      return InvitationService.create({
        sessionUserId: inviter.id,
        groupId: group.id,
        emails: ['foo', 'bar', 'foo@foo.com', 'bar@bar.com'],
        subject,
        message
      })
        .then(results => {
          expect(results).to.deep.equal([
            { email: 'foo', error: 'not a valid email address' },
            { email: 'bar', error: 'not a valid email address' },
            { email: 'foo@foo.com', lastSentAt: undefined, createdAt: undefined, id: results[2].id },
            { email: 'bar@bar.com', lastSentAt: undefined, createdAt: undefined, id: results[3].id }
          ])

          expect(Queue.classMethod).to.have.been.called.exactly(2)
          const firstInvitation = queuedCalls[0][2].invitation
          const secondInvitation = queuedCalls[1][2].invitation
          expect(queuedCalls).to.deep.equal([
            [
              'Invitation',
              'createAndSend',
              {
                invitation: firstInvitation
              }
            ],
            [
              'Invitation',
              'createAndSend',
              {
                invitation: secondInvitation
              }
            ]
          ])
        })
    })

    it('creates an in-app notification when inviting an existing user by id', async () => {
      const results = await InvitationService.create({
        sessionUserId: inviter.id,
        groupId: group.id,
        userIds: [invitee.id],
        subject,
        message
      })
      expect(results[0].error).to.be.undefined
      const activity = await Activity.where({
        reader_id: invitee.id,
        actor_id: inviter.id,
        group_id: group.id
      }).fetch()
      expect(activity).to.exist
      expect(activity.get('meta').reasons).to.include('groupInvitation')
    })

    it('does not create an in-app notification for email-only invites', async () => {
      const emailOnlyUser = await factories.user().save()
      await InvitationService.create({
        sessionUserId: inviter.id,
        groupId: group.id,
        emails: [emailOnlyUser.get('email')],
        subject,
        message
      })
      const activity = await Activity.where({
        reader_id: emailOnlyUser.id,
        group_id: group.id
      }).fetch()
      expect(activity).to.be.null
    })

    it('includes the parent group on space invitation notifications', async () => {
      const parent = await factories.group().save()
      const space = await factories.group({ type: 'space', parent_id: parent.id }).save()
      await InvitationService.create({
        sessionUserId: inviter.id,
        groupId: space.id,
        userIds: [invitee.id],
        subject,
        message
      })
      const activity = await Activity.where({
        reader_id: invitee.id,
        group_id: space.id
      }).fetch()
      expect(activity.get('other_group_id')).to.equal(parent.id)
    })
  })
})
