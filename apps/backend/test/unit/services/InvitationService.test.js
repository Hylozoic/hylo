/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify, withFeatureFlag } = require(root('test/setup/helpers'))
const InvitationService = require(root('api/services/InvitationService'))
const { joinGroup } = require(root('api/graphql/mutations/group'))

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

    it('records invite_link as the source of a membership made with an access code', async function () {
      const linkUser = await factories.user().save()
      const membership = await InvitationService.use(linkUser.id, null, group.get('access_code'))
      expect(membership.getSetting('joinSource')).to.equal('invite_link')
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

  describe('member invitations and approval', () => {
    let sponsor, open, restricted, closed, parent, space

    const memberInvitation = (target, email = `invitee-${Date.now()}-${Math.random()}@approval.com`) =>
      Invitation.create({ userId: sponsor.id, groupId: target.id, email, inviterAccess: Invitation.InviterAccess.LIMITED })
    const stewardInvitation = (target, email = `invitee-${Date.now()}-${Math.random()}@approval.com`) =>
      Invitation.create({ userId: inviter.id, groupId: target.id, email })

    before(async () => {
      sponsor = await factories.user({ name: 'Sponsoring Member', avatar_url: 'https://example.com/sponsor.png' }).save()
      open = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      closed = await factories.group({ accessibility: Group.Accessibility.CLOSED }).save()
      parent = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      space = await factories.group({ type: 'space', parent_id: parent.id, accessibility: Group.Accessibility.OPEN }).save()
    })

    it('pre-approves a member invitation only for its own Open top-level group', async () => {
      expect(await InvitationService.preApproves(await memberInvitation(open), open)).to.be.true
      expect(await InvitationService.preApproves(await memberInvitation(restricted), restricted)).to.be.false
      expect(await InvitationService.preApproves(await memberInvitation(closed), closed)).to.be.false
      expect(await InvitationService.preApproves(await memberInvitation(open), restricted)).to.be.false
      expect(await InvitationService.preApproves(await memberInvitation(space), space)).to.be.false
      expect(await InvitationService.preApproves(await memberInvitation(space), parent)).to.be.false
      expect(await InvitationService.preApproves(null, open)).to.be.false
    })

    it('pre-approves other invitations for their own group and a space invitation for its parent', async () => {
      expect(await InvitationService.preApproves(await stewardInvitation(closed), closed)).to.be.true
      expect(await InvitationService.preApproves(await stewardInvitation(space), space)).to.be.true
      expect(await InvitationService.preApproves(await stewardInvitation(space), parent)).to.be.true
      expect(await InvitationService.preApproves(await stewardInvitation(closed), restricted)).to.be.false
    })

    it('tells the person invited by a member who invited them and whether a steward approves them', async () => {
      const sender = { id: sponsor.id, name: 'Sponsoring Member', avatarUrl: 'https://example.com/sponsor.png' }

      const restrictedCheck = await InvitationService.check((await memberInvitation(restricted)).get('token'))
      expect(restrictedCheck).to.include({ valid: true, groupSlug: restricted.get('slug'), requiresApproval: true })
      expect(restrictedCheck.invitedBy).to.deep.equal(sender)

      expect(await InvitationService.check((await memberInvitation(closed)).get('token'))).to.include({ requiresApproval: true })

      const openCheck = await InvitationService.check((await memberInvitation(open)).get('token'))
      expect(openCheck.requiresApproval).to.be.false
      expect(openCheck.invitedBy).to.deep.equal(sender)
    })

    it('decides approval from the group\'s accessibility at the time of the check', async () => {
      const changing = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const token = (await memberInvitation(changing)).get('token')
      expect((await InvitationService.check(token)).requiresApproval).to.be.false
      await changing.save({ accessibility: Group.Accessibility.RESTRICTED }, { patch: true })
      expect((await InvitationService.check(token)).requiresApproval).to.be.true
    })

    it('needs no approval for other invitations and join links, and names the sender of an email invitation only', async () => {
      const tokenCheck = await InvitationService.check((await stewardInvitation(restricted)).get('token'))
      expect(tokenCheck).to.include({ valid: true, requiresApproval: false })
      expect(tokenCheck.invitedBy).to.deep.equal({ id: inviter.id, name: inviter.get('name'), avatarUrl: inviter.get('avatar_url') || null })
      const codeCheck = await InvitationService.check(null, restricted.get('access_code'))
      expect(codeCheck).to.include({ valid: true, requiresApproval: false, invitedBy: null })
    })

    it('does not join a Restricted or Closed group with a member invitation, and asks for a request instead', async () => {
      for (const target of [restricted, closed]) {
        const person = await factories.user().save()
        const invitation = await memberInvitation(target, person.get('email'))
        const result = await InvitationService.use(person.id, invitation.get('token'))
        expect(result).to.deep.equal({ requiresApproval: true, groupSlug: target.get('slug') })
        expect(await GroupMembership.forPair(person.id, target.id, { includeInactive: true }).fetch()).to.not.exist
        await invitation.refresh()
        expect(invitation.get('used_by_id')).to.be.null
      }
    })

    it('joins an Open group with a member invitation', async () => {
      const person = await factories.user().save()
      const invitation = await memberInvitation(open, person.get('email'))
      const membership = await InvitationService.use(person.id, invitation.get('token'))
      expect(membership.get('user_id')).to.equal(person.id)
      expect(membership.get('group_id')).to.equal(open.id)
      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.equal(person.id)
    })

    it('does not join an Open group with a member invitation before its prerequisite groups', async () => {
      const prerequisite = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const gated = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      await GroupRelationship.forge({
        parent_group_id: prerequisite.id,
        child_group_id: gated.id,
        active: true,
        settings: { isPrerequisite: true }
      }).save()
      const person = await factories.user().save()
      const invitation = await memberInvitation(gated, person.get('email'))

      const result = await InvitationService.use(person.id, invitation.get('token'))
      expect(result).to.deep.equal({ requiresApproval: true, groupSlug: gated.get('slug') })
      expect(await GroupMembership.forPair(person.id, gated.id, { includeInactive: true }).fetch()).to.not.exist
      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.be.null

      await person.joinGroup(prerequisite)
      const membership = await InvitationService.use(person.id, invitation.get('token'))
      expect(membership.get('group_id')).to.equal(gated.id)
    })

    it('returns the membership of someone already in the group', async () => {
      const person = await factories.user().save()
      await person.joinGroup(restricted)
      const invitation = await memberInvitation(restricted, person.get('email'))
      const membership = await InvitationService.use(person.id, invitation.get('token'))
      expect(membership.get('group_id')).to.equal(restricted.id)
    })

    it('still joins a Restricted group with a steward invitation', async () => {
      const person = await factories.user().save()
      const invitation = await stewardInvitation(restricted, person.get('email'))
      const membership = await InvitationService.use(person.id, invitation.get('token'))
      expect(membership.get('group_id')).to.equal(restricted.id)
    })
  })

  describe("members' personal invite links", () => {
    let open, restricted, openOwner, restrictedOwner, openLink, restrictedLink

    const ledgerTotal = async userId => {
      const row = await bookshelf.knex('invitation_sends').where({ user_id: userId }).sum('recipients as total').first()
      return Number(row.total || 0)
    }
    const memberOf = (user, group) => GroupMembership.forPair(user.id, group.id, { includeInactive: true }).fetch()

    before(async () => {
      open = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      openOwner = await factories.user({ name: 'Open Link Owner' }).save()
      restrictedOwner = await factories.user({ name: 'Restricted Link Owner' }).save()
      await openOwner.joinGroup(open)
      await restrictedOwner.joinGroup(restricted)
      await GroupRole.setInvitePolicy(open.id, { mode: 'everyone' })
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
      openLink = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: openOwner.id })
      restrictedLink = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: restrictedOwner.id })
    })

    it('gives each member one code per group, unlike any join link code, and finds it whatever its case', async () => {
      const again = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: openOwner.id })
      expect(again.id).to.equal(openLink.id)
      expect(openLink.get('code')).to.have.lengthOf(MemberInviteLink.CODE_LENGTH)
      expect(await Group.queryByAccessCode(openLink.get('code')).fetch({ require: false })).to.not.exist
      expect((await MemberInviteLink.findByCode(openLink.get('code').toUpperCase())).id).to.equal(openLink.id)
      expect(openLink.path(open)).to.equal(`/groups/${open.get('slug')}/join/${openLink.get('code')}`)
    })

    it('checks a member code like a join link, saying who invited the person and whether a steward approves them', async () => {
      const openCheck = await InvitationService.check(null, openLink.get('code'))
      expect(openCheck).to.include({ valid: true, groupSlug: open.get('slug'), isMemberLink: true, requiresApproval: false, tryLater: false })
      expect(openCheck.invitedBy).to.deep.equal({ id: openOwner.id, name: 'Open Link Owner', avatarUrl: openOwner.get('avatar_url') || null })

      const restrictedCheck = await InvitationService.check(null, restrictedLink.get('code'))
      expect(restrictedCheck).to.include({ valid: true, isMemberLink: true, requiresApproval: true })

      const joinLinkCheck = await InvitationService.check(null, open.get('access_code'))
      expect(joinLinkCheck.isMemberLink).to.not.be.ok
    })

    it("joins an Open group through a member code, counting the person toward the owner's day", async () => {
      const person = await factories.user().save()
      const before = await ledgerTotal(openOwner.id)
      const membership = await InvitationService.use(person.id, null, openLink.get('code'))
      expect(membership.get('group_id')).to.equal(open.id)
      expect(membership.getSetting('joinSource')).to.equal('member_link')
      expect(String(membership.getSetting('invitedById'))).to.equal(String(openOwner.id))
      expect(await ledgerTotal(openOwner.id)).to.equal(before + 1)

      const again = await InvitationService.use(person.id, null, openLink.get('code'))
      expect(again.id).to.equal(membership.id)
      expect(await ledgerTotal(openOwner.id)).to.equal(before + 1)
    })

    it('asks for a request instead of joining a Restricted group, without counting anyone yet', async () => {
      const person = await factories.user().save()
      const before = await ledgerTotal(restrictedOwner.id)
      expect(await InvitationService.use(person.id, null, restrictedLink.get('code')))
        .to.deep.equal({ requiresApproval: true, groupSlug: restricted.get('slug') })
      expect(await memberOf(person, restricted)).to.not.exist
      expect(await ledgerTotal(restrictedOwner.id)).to.equal(before)
    })

    it('joins through the joinGroup mutation only where the link lets people in directly', async () => {
      const person = await factories.user().save()
      const membership = await joinGroup(open.id, person.id, [], openLink.get('code'))
      expect(membership.getSetting('joinSource')).to.equal('member_link')

      const outsider = await factories.user().save()
      await expect(joinGroup(restricted.id, outsider.id, [], restrictedLink.get('code'))).to.be.rejectedWith('You do not have permission to do that')
      expect(await memberOf(outsider, restricted)).to.not.exist
    })

    it("says to try again later, and lets nobody in, once the owner's or the group's allowance is used up", async () => {
      const busyGroup = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const busyOwner = await factories.user().save()
      await busyOwner.joinGroup(busyGroup)
      await GroupRole.setInvitePolicy(busyGroup.id, { mode: 'everyone' })
      const busyLink = await MemberInviteLink.findOrCreate({ groupId: busyGroup.id, userId: busyOwner.id })
      await bookshelf.knex('invitation_sends').insert({ user_id: busyOwner.id, group_id: busyGroup.id, recipients: InvitationSend.LIMITS.perInviterPerDay })

      expect((await InvitationService.check(null, busyLink.get('code'))).tryLater).to.be.true
      const person = await factories.user().save()
      await expect(InvitationService.use(person.id, null, busyLink.get('code'))).to.be.rejectedWith(InvitationService.MEMBER_LINK_TRY_LATER)
      await expect(joinGroup(busyGroup.id, person.id, [], busyLink.get('code'))).to.be.rejectedWith(InvitationService.MEMBER_LINK_TRY_LATER)
      expect(await memberOf(person, busyGroup)).to.not.exist
    })

    it('stops an old code working once the member resets their link', async () => {
      const owner = await factories.user().save()
      await owner.joinGroup(open)
      const first = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: owner.id })
      const second = await MemberInviteLink.reset({ groupId: open.id, userId: owner.id })
      expect(second.get('code')).to.not.equal(first.get('code'))
      expect(await InvitationService.check(null, first.get('code'))).to.deep.equal({ valid: false })
      await expect(InvitationService.use((await factories.user().save()).id, null, first.get('code'))).to.be.rejectedWith('Invalid access code')
      expect((await InvitationService.check(null, second.get('code'))).valid).to.be.true
    })

    it('stops working when its owner leaves or is removed from the group', async () => {
      const owner = await factories.user().save()
      await owner.joinGroup(open)
      const link = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: owner.id })
      await open.removeMembers([owner.id])
      await link.refresh()
      expect(link.get('revoked_at')).to.exist
      expect(await InvitationService.check(null, link.get('code'))).to.deep.equal({ valid: false })

      await owner.joinGroup(open)
      expect(await InvitationService.check(null, link.get('code'))).to.deep.equal({ valid: false })
    })

    it('stops working for good when its owner deactivates their account', async () => {
      const owner = await factories.user().save()
      await owner.joinGroup(open)
      await owner.joinGroup(restricted)
      const links = [
        await MemberInviteLink.findOrCreate({ groupId: open.id, userId: owner.id }),
        await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: owner.id })
      ]
      mockify(Queue, 'classMethod', () => Promise.resolve())
      try {
        await owner.deactivate('session')
      } finally {
        unspyify(Queue, 'classMethod')
      }
      await owner.reactivate()
      for (const link of links) {
        await link.refresh()
        expect(link.get('revoked_at')).to.exist
        expect(await InvitationService.check(null, link.get('code'))).to.deep.equal({ valid: false })
      }
      expect(await MemberInviteLink.findActive({ groupId: open.id, userId: openOwner.id })).to.exist
    })

    it('lets nobody into a Restricted group if the link stops working while they join', async () => {
      const person = await factories.user().save()
      mockify(InvitationService, 'usableMemberLink', () => Promise.resolve(null))
      try {
        await expect(joinGroup(restricted.id, person.id, [], restrictedLink.get('code'))).to.be.rejectedWith('You do not have permission to do that')
      } finally {
        unspyify(InvitationService, 'usableMemberLink')
      }
      expect(await memberOf(person, restricted)).to.not.exist
    })

    it('stops working when its owner can no longer invite people, and stays revoked after', async () => {
      const policyGroup = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const owner = await factories.user().save()
      const steward = await factories.user().save()
      await owner.joinGroup(policyGroup)
      await steward.joinGroup(policyGroup, { assignAdministrator: true })
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      const link = await MemberInviteLink.findOrCreate({ groupId: policyGroup.id, userId: owner.id })
      const stewardLink = await MemberInviteLink.findOrCreate({ groupId: policyGroup.id, userId: steward.id })

      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })
      expect(await InvitationService.check(null, link.get('code'))).to.deep.equal({ valid: false })
      expect((await MemberInviteLink.revokeWithoutInviteAccess(policyGroup.id)).map(String)).to.deep.equal([String(owner.id)])

      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      expect(await InvitationService.check(null, link.get('code'))).to.deep.equal({ valid: false })
      expect((await InvitationService.check(null, stewardLink.get('code'))).valid).to.be.true
    })

    it('does not work while member invitations are switched off', async () => {
      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        expect(await InvitationService.check(null, openLink.get('code'))).to.deep.equal({ valid: false })
        expect(await MemberInviteLink.revokeWithoutInviteAccess(open.id)).to.deep.equal([])
      })
      expect((await InvitationService.check(null, openLink.get('code'))).valid).to.be.true
    })
  })

  describe('people to invite', () => {
    let pickerGroup, member, outsider, leaver, axolotl

    const peopleIds = async opts => {
      const people = await Search.forUsers({ limit: 1000, ...opts }).fetchAll()
      return people.map(person => String(person.id))
    }

    before(async () => {
      pickerGroup = await factories.group().save()
      member = await factories.user({ name: 'Picker Member' }).save()
      outsider = await factories.user({ name: 'Picker Outsider' }).save()
      leaver = await factories.user({ name: 'Picker Leaver' }).save()
      axolotl = await User.where({ id: User.AXOLOTL_ID }).fetch() ||
        await factories.user({ id: User.AXOLOTL_ID, name: 'Picker Axolotl' }).save(null, { method: 'insert' })
      await member.joinGroup(pickerGroup)
      await leaver.joinGroup(pickerGroup)
      await pickerGroup.removeMembers([leaver.id])
    })

    it('leaves out active members of the group and the Axolotl when asked', async () => {
      const ids = await peopleIds({ excludeGroupId: pickerGroup.id })
      expect(ids).to.include(String(outsider.id))
      expect(ids).to.include(String(leaver.id))
      expect(ids).to.not.include(String(member.id))
      expect(ids).to.not.include(String(axolotl.id))
    })

    it('leaves everyone in when not asked', async () => {
      const ids = await peopleIds({})
      expect(ids).to.include.members([String(outsider.id), String(member.id), String(axolotl.id)])
    })

    it('finds only people who share an active group with someone, when asked', async () => {
      const searcher = await factories.user().save()
      const sharedGroup = await factories.group().save()
      const formerGroup = await factories.group().save()
      const neighbour = await factories.user().save()
      const formerNeighbour = await factories.user().save()
      await searcher.joinGroup(sharedGroup)
      await neighbour.joinGroup(sharedGroup)
      await searcher.joinGroup(formerGroup)
      await formerNeighbour.joinGroup(formerGroup)
      await formerGroup.removeMembers([formerNeighbour.id])

      const ids = await peopleIds({ sharedWithUserId: searcher.id })
      expect(ids).to.include(String(neighbour.id))
      expect(ids).to.not.include(String(formerNeighbour.id))
      expect(ids).to.not.include(String(outsider.id))
    })
  })

  describe('members inviting people from the people search', () => {
    let pickGroup, sender, sharedGroup, neighbour, existingMember, alreadyInvited, blockedPerson, stranger, queued

    const notifications = readerId => Activity.where({ reader_id: readerId, group_id: pickGroup.id }).fetchAll()
    const ledgerTotal = async userId => {
      const row = await bookshelf.knex('invitation_sends').where({ user_id: userId }).sum('recipients as total').first()
      return Number(row.total || 0)
    }

    before(async () => {
      pickGroup = await factories.group().save()
      sharedGroup = await factories.group().save()
      sender = await factories.user().save()
      await sender.joinGroup(pickGroup)
      await sender.joinGroup(sharedGroup)
      neighbour = await factories.user().save()
      existingMember = await factories.user().save()
      alreadyInvited = await factories.user().save()
      blockedPerson = await factories.user().save()
      stranger = await factories.user().save()
      for (const person of [neighbour, existingMember, alreadyInvited, blockedPerson]) {
        await person.joinGroup(sharedGroup)
      }
      await existingMember.joinGroup(pickGroup)
      await Invitation.create({ userId: inviter.id, groupId: pickGroup.id, email: alreadyInvited.get('email') })
      await BlockedUser.create(blockedPerson.id, sender.id)
      queued = []
      mockify(Queue, 'classMethod', (cls, method, data) => Promise.resolve(queued.push([cls, method, data])))
    })

    it('invites only people who share a group with the sender, in the app and not by email, and says the same for everyone', async () => {
      const picked = [neighbour, existingMember, alreadyInvited, blockedPerson, sender].map(person => String(person.id))
      const results = await InvitationService.createLimitedForUsers({
        sessionUserId: sender.id,
        groupId: pickGroup.id,
        userIds: [...picked, String(stranger.id), String(neighbour.id)],
        subject: 'Join us',
        message: 'Come along'
      })

      expect(results).to.deep.equal([
        ...picked.map(userId => ({ userId, status: 'sent' })),
        { userId: String(stranger.id), error: 'invalid' }
      ])
      const invitations = await Invitation.where({ group_id: pickGroup.id, invited_by_id: sender.id }).fetchAll()
      expect(invitations.map(i => [i.get('email'), i.get('inviter_access'), i.get('sent_count')])).to.deep.equal([
        [neighbour.get('email').toLowerCase(), 'limited', 0]
      ])
      expect(queued.filter(([cls]) => cls === 'Invitation')).to.have.lengthOf(0)
      expect(await ledgerTotal(sender.id)).to.equal(5)
      expect((await notifications(neighbour.id)).length).to.equal(1)
      for (const person of [existingMember, alreadyInvited, blockedPerson, stranger]) {
        expect((await notifications(person.id)).length).to.equal(0)
      }
    })

    it('keeps to the same limits as email invitations', async () => {
      const busySender = await factories.user().save()
      await busySender.joinGroup(pickGroup)
      await busySender.joinGroup(sharedGroup)
      const people = []
      for (let i = 0; i < 11; i++) {
        const person = await factories.user().save()
        await person.joinGroup(sharedGroup)
        people.push(String(person.id))
      }
      await expect(InvitationService.createLimitedForUsers({ sessionUserId: busySender.id, groupId: pickGroup.id, userIds: people }))
        .to.be.rejectedWith('You can invite up to 10 email addresses at a time')

      await bookshelf.knex('invitation_sends').insert({ user_id: busySender.id, group_id: pickGroup.id, recipients: 20 })
      await expect(InvitationService.createLimited({
        sessionUserId: busySender.id,
        groupId: pickGroup.id,
        emails: ['one@picker-limits.com', 'two@picker-limits.com'],
        userIds: people.slice(0, 4)
      })).to.be.rejectedWith('invite-limit')
      expect(await ledgerTotal(busySender.id)).to.equal(20)

      const results = await InvitationService.createLimited({
        sessionUserId: busySender.id,
        groupId: pickGroup.id,
        emails: ['one@picker-limits.com'],
        userIds: people.slice(0, 4)
      })
      expect(results.filter(result => result.status === 'sent')).to.have.lengthOf(5)
      expect(await InvitationSend.remainingAllowance({ userId: busySender.id, groupId: pickGroup.id })).to.equal(0)
    })

    after(() => unspyify(Queue, 'classMethod'))
  })

  describe("a member's list of what they submitted", () => {
    let submitGroup, member, existing, otherSender, invitedByOther

    const list = (opts = {}) => InvitationService.findOwnLimited({ groupId: submitGroup.id, userId: member.id, ...opts })
    const pending = email => Invitation.query(q => {
      q.where({ group_id: submitGroup.id, email })
      q.whereNull('used_by_id')
      q.whereNull('expired_by_id')
    }).fetch()

    before(async () => {
      mockify(Queue, 'classMethod', () => Promise.resolve())
      submitGroup = await factories.group().save()
      member = await factories.user({ email: 'submitter@member-submissions.com' }).save()
      existing = await factories.user({ email: 'existing@member-submissions.com' }).save()
      otherSender = await factories.user().save()
      await member.joinGroup(submitGroup)
      await existing.joinGroup(submitGroup)
      invitedByOther = 'invited@member-submissions.com'
      await Invitation.create({ userId: otherSender.id, groupId: submitGroup.id, email: invitedByOther })
      await InvitationService.createLimited({
        sessionUserId: member.id,
        groupId: submitGroup.id,
        emails: ['fresh@member-submissions.com', 'EXISTING@member-submissions.com', invitedByOther, member.get('email'), 'not-an-email'],
        subject: 'Join us',
        message: 'Come along'
      })
    })

    after(() => unspyify(Queue, 'classMethod'))

    it('shows every valid address the same way, whether or not an invitation went out', async () => {
      const { total, items } = await list()
      expect(total).to.equal(4)
      expect(items.map(item => item.email).sort()).to.deep.equal([
        'existing@member-submissions.com',
        'fresh@member-submissions.com',
        'invited@member-submissions.com',
        'submitter@member-submissions.com'
      ])
      for (const item of items) {
        expect(Object.keys(item).sort()).to.deep.equal(['createdAt', 'email', 'id', 'person'])
        expect(item.person).to.be.null
        expect(item.createdAt).to.be.an.instanceof(Date)
      }
      expect(await pending('fresh@member-submissions.com')).to.exist
      expect((await list({ limit: 2 })).items).to.have.lengthOf(2)
      expect((await InvitationService.findOwnLimited({ groupId: submitGroup.id, userId: otherSender.id })).total).to.equal(0)
    })

    it('keeps a row until it ages out, on the same day for sent and skipped addresses, even after its invitation is used', async () => {
      const invitation = await pending('fresh@member-submissions.com')
      await invitation.save({ used_by_id: existing.id, used_at: new Date() }, { patch: true })
      expect((await list()).total).to.equal(4)

      const days = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
      await bookshelf.knex('invitation_submissions').where({ user_id: member.id, group_id: submitGroup.id })
        .update({ created_at: days(InvitationService.SUBMISSION_LIST_DAYS - 1) })
      expect((await list()).total).to.equal(4)
      await bookshelf.knex('invitation_submissions').where({ user_id: member.id, group_id: submitGroup.id })
        .update({ created_at: days(InvitationService.SUBMISSION_LIST_DAYS + 1) })
      expect((await list()).total).to.equal(0)
      await bookshelf.knex('invitation_submissions').where({ user_id: member.id, group_id: submitGroup.id })
        .update({ created_at: new Date() })
    })

    it('cancels a row the same way whether or not it has an invitation, and cancels a pending invitation', async () => {
      await InvitationService.createLimited({ sessionUserId: member.id, groupId: submitGroup.id, emails: ['second@member-submissions.com'] })
      const { items } = await list()
      const sent = items.find(item => item.email === 'second@member-submissions.com')
      const skipped = items.find(item => item.email === 'existing@member-submissions.com')

      await expect(InvitationService.cancelSubmission({ userId: otherSender.id, submissionId: sent.id })).to.be.rejectedWith('not found')
      expect(await InvitationService.cancelSubmission({ userId: member.id, submissionId: sent.id })).to.deep.equal({ success: true })
      expect(await InvitationService.cancelSubmission({ userId: member.id, submissionId: skipped.id })).to.deep.equal({ success: true })
      await expect(InvitationService.cancelSubmission({ userId: member.id, submissionId: skipped.id })).to.be.rejectedWith('not found')
      await expect(InvitationService.cancelSubmission({ userId: member.id, submissionId: 'abc' })).to.be.rejectedWith('not found')

      expect(await pending('second@member-submissions.com')).to.not.exist
      const expired = await Invitation.where({ group_id: submitGroup.id, email: 'second@member-submissions.com' }).fetch()
      expect(expired.get('expired_by_id')).to.equal(member.id)
      expect(await pending(invitedByOther)).to.exist
      const remaining = (await list()).items.map(item => item.email)
      expect(remaining).to.not.include.members(['second@member-submissions.com', 'existing@member-submissions.com'])
      expect(remaining).to.have.lengthOf(3)
    })

    it('lists people picked from the people search by name, with no email address', async () => {
      const neighbourhood = await factories.group().save()
      const neighbour = await factories.user({ name: 'Picked Neighbour' }).save()
      await member.joinGroup(neighbourhood)
      await neighbour.joinGroup(neighbourhood)
      await InvitationService.createLimitedForUsers({ sessionUserId: member.id, groupId: submitGroup.id, userIds: [neighbour.id] })

      const [newest] = (await list()).items
      expect(newest.email).to.be.null
      expect(newest.person).to.deep.equal({ id: neighbour.id, name: 'Picked Neighbour', avatarUrl: neighbour.get('avatar_url') || null })
    })
  })

  describe('addresses that asked for no more invitations', () => {
    let optOutGroup, admin, member, queued

    before(async () => {
      optOutGroup = await factories.group().save()
      admin = await factories.user().save()
      member = await factories.user().save()
      await admin.joinGroup(optOutGroup, { assignAdministrator: true })
      await member.joinGroup(optOutGroup)
      await InvitationOptOut.record({ email: 'no-thanks@opt-out.com' })
      queued = []
      mockify(Queue, 'classMethod', (cls, method, data) => Promise.resolve(queued.push([cls, method, data])))
    })

    beforeEach(() => { queued = [] })

    after(() => unspyify(Queue, 'classMethod'))

    const invitationsTo = email => Invitation.where({ group_id: optOutGroup.id, email }).fetchAll()

    it('are left out of invitations from stewards without saying so', async () => {
      const results = await InvitationService.create({
        sessionUserId: admin.id,
        groupId: optOutGroup.id,
        emails: ['No-Thanks@opt-out.com', 'welcome@opt-out.com'],
        subject: 'Join us',
        message: 'Come along'
      })
      expect(results[0]).to.deep.equal({ email: 'No-Thanks@opt-out.com' })
      expect(results[1].id).to.exist
      expect((await invitationsTo('no-thanks@opt-out.com')).length).to.equal(0)
      expect(queued).to.have.lengthOf(1)
    })

    it('are counted and reported as sent for members, like people already in the group, with no invitation', async () => {
      const results = await InvitationService.createLimited({
        sessionUserId: member.id,
        groupId: optOutGroup.id,
        emails: ['no-thanks@opt-out.com', 'member-friend@opt-out.com']
      })
      expect(results).to.deep.equal([
        { email: 'no-thanks@opt-out.com', status: 'sent' },
        { email: 'member-friend@opt-out.com', status: 'sent' }
      ])
      expect((await invitationsTo('no-thanks@opt-out.com')).length).to.equal(0)
      expect((await invitationsTo('member-friend@opt-out.com')).length).to.equal(1)
      expect(await InvitationSend.remainingAllowance({ userId: member.id, groupId: optOutGroup.id }))
        .to.equal(InvitationSend.LIMITS.perInviterPerDay - 2)
      const { items } = await InvitationService.findOwnLimited({ groupId: optOutGroup.id, userId: member.id })
      expect(items.map(item => item.email).sort()).to.deep.equal(['member-friend@opt-out.com', 'no-thanks@opt-out.com'])
    })
  })

  describe('pending invitation lists', () => {
    let listGroup, admin, member, other, memberInvitations

    before(async () => {
      admin = await factories.user().save()
      member = await factories.user().save()
      other = await factories.user().save()
      listGroup = await factories.group().save()
      await admin.joinGroup(listGroup, { assignAdministrator: true })
      await member.joinGroup(listGroup)
      await other.joinGroup(listGroup)

      const create = (sender, email, inviterAccess) =>
        Invitation.create({ userId: sender.id, groupId: listGroup.id, email, inviterAccess })
      await create(admin, invitee.get('email'), Invitation.InviterAccess.FULL)
      memberInvitations = [
        await create(member, 'first@member-list.com', Invitation.InviterAccess.LIMITED),
        await create(member, 'second@member-list.com', Invitation.InviterAccess.LIMITED),
        await create(member, 'third@member-list.com', Invitation.InviterAccess.LIMITED)
      ]
      await create(member, 'old-steward-invite@member-list.com', Invitation.InviterAccess.FULL)
      await create(other, 'other@member-list.com', Invitation.InviterAccess.LIMITED)
      const used = await create(member, 'used@member-list.com', Invitation.InviterAccess.LIMITED)
      await used.save({ used_by_id: other.id, used_at: new Date() }, { patch: true })
      await memberInvitations[2].expire(member.id)
    })

    it('gives the full list with who sent each invitation and how, and respects the limit', async () => {
      const { total, items } = await InvitationService.find({ groupId: listGroup.id, pendingOnly: true })
      expect(total).to.equal(5)
      const byEmail = Object.fromEntries(items.map(item => [item.email, item]))
      expect(byEmail[invitee.get('email').toLowerCase()]).to.include({ inviter_access: 'full', userId: invitee.id })
      expect(byEmail['other@member-list.com'].inviter_access).to.equal('limited')
      const creator = await byEmail['other@member-list.com'].creator().fetch()
      expect(creator.id).to.equal(other.id)

      const firstTwo = await InvitationService.find({ groupId: listGroup.id, pendingOnly: true, limit: 2 })
      expect(firstTwo.total).to.equal(5)
      expect(firstTwo.items).to.have.lengthOf(2)
    })

    it('lists nothing for a member from invitations alone: their list comes from what they submitted', async () => {
      const { total, items } = await InvitationService.findOwnLimited({ groupId: listGroup.id, userId: member.id })
      expect(total).to.equal(0)
      expect(items).to.deep.equal([])
    })

    it('lets the sender of a member invitation cancel it, as well as the invitee and stewards', async () => {
      const [first] = memberInvitations
      const stewardInvitation = await Invitation.create({ userId: member.id, groupId: listGroup.id, email: 'steward-sent@member-list.com' })
      expect(await InvitationService.canExpire(member.id, first.id)).to.be.true
      expect(await InvitationService.canExpire(admin.id, first.id)).to.be.true
      expect(await InvitationService.canExpire(other.id, first.id)).to.be.false
      expect(await InvitationService.canExpire(member.id, stewardInvitation.id)).to.be.false
      expect(await InvitationService.checkPermission(member.id, first.id)).to.be.false
      await expect(InvitationService.canExpire(member.id, '999999999')).to.be.rejectedWith('Invitation not found')
    })
  })
})
