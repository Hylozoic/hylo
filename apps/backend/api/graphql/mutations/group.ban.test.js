/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { withFeatureFlag } from '../../../test/setup/helpers'
import InvitationService from '../../services/InvitationService'
import { createRequestHandler } from '../index'
import { banFromGroup, joinGroup, liftGroupBan, removeMember } from './group'

const BANNED = "You can't join this group"

const isActiveMember = async (user, group) => !!(await GroupMembership.forPair(user.id, group.id).fetch())

describe('blocking removed people from rejoining a group', () => {
  let steward, member, outsider, open, restricted

  // A member of the group whom the steward then removes and blocks
  const removedAndBlocked = async group => {
    const person = await factories.user().save()
    await person.joinGroup(group)
    await removeMember(steward.id, person.id, group.id, {}, { blockFromRejoining: true })
    return person
  }

  before(async () => {
    steward = await factories.user().save()
    member = await factories.user().save()
    outsider = await factories.user().save()
    open = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
    restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
    await assignAdministrator(steward, open)
    await assignAdministrator(steward, restricted)
    await member.joinGroup(open)
    await member.joinGroup(restricted)
  })

  after(async function () {
    this.timeout(10000)
    await setup.clearDb()
  })

  describe('removeMember', () => {
    it('removes without a block unless asked to', async () => {
      const person = await factories.user().save()
      await person.joinGroup(open)
      await removeMember(steward.id, person.id, open.id, {})
      expect(await isActiveMember(person, open)).to.be.false
      expect(await GroupBan.isBanned(person.id, open.id)).to.be.false
      const membership = await joinGroup(open.id, person.id, [])
      expect(membership.get('active')).to.be.true
    })

    it('records who blocked whom when asked to block', async () => {
      const person = await removedAndBlocked(open)
      const ban = await GroupBan.active({ groupId: open.id, userId: person.id })
      expect(ban).to.exist
      expect(String(ban.get('created_by_id'))).to.equal(String(steward.id))
      expect(await isActiveMember(person, open)).to.be.false
    })

    it('refuses to block someone from a space, or yourself', async () => {
      const space = await factories.group({ type: 'space', parent_id: open.id }).save()
      await assignAdministrator(steward, space)
      const person = await factories.user().save()
      await person.joinGroup(space)
      await expect(removeMember(steward.id, person.id, space.id, {}, { blockFromRejoining: true }))
        .to.be.rejectedWith('Block people from rejoining the group this space belongs to')
      expect(await isActiveMember(person, space)).to.be.true
      await expect(removeMember(steward.id, steward.id, open.id, {}, { blockFromRejoining: true }))
        .to.be.rejectedWith("You can't block yourself from rejoining a group")
    })
  })

  describe('banFromGroup', () => {
    it('blocks someone already removed, once', async () => {
      const person = await factories.user().save()
      await person.joinGroup(open)
      await removeMember(steward.id, person.id, open.id, {})
      expect(await banFromGroup(steward.id, person.id, open.id)).to.deep.equal({ success: true })
      expect(await banFromGroup(steward.id, person.id, open.id)).to.deep.equal({ success: true })
      const count = await bookshelf.knex('group_bans').where({ group_id: open.id, user_id: person.id }).count('id as n').first()
      expect(Number(count.n)).to.equal(1)
    })

    it('asks to remove a current member first, and only lets people who can remove members block', async () => {
      await expect(banFromGroup(steward.id, member.id, open.id)).to.be.rejectedWith('Remove this person from the group first')
      await expect(banFromGroup(member.id, outsider.id, open.id)).to.be.rejectedWith("You don't have the right responsibilities for this group")
      expect(await GroupBan.isBanned(outsider.id, open.id)).to.be.false
    })
  })

  describe('every route back in', () => {
    it('refuses joining an Open group directly', async () => {
      const person = await removedAndBlocked(open)
      await expect(joinGroup(open.id, person.id, [])).to.be.rejectedWith(BANNED)
      expect(await isActiveMember(person, open)).to.be.false
    })

    it("refuses the group's join link, through the mutation and the invitation service", async () => {
      const person = await removedAndBlocked(restricted)
      await expect(joinGroup(restricted.id, person.id, [], restricted.get('access_code'))).to.be.rejectedWith(BANNED)
      await expect(InvitationService.use(person.id, null, restricted.get('access_code'))).to.be.rejectedWith(BANNED)
      expect(await isActiveMember(person, restricted)).to.be.false
    })

    it('refuses an email invitation, used or accepted from the about page', async () => {
      const person = await removedAndBlocked(restricted)
      const invitation = await Invitation.create({ userId: steward.id, groupId: restricted.id, email: person.get('email') })
      await expect(InvitationService.use(person.id, invitation.get('token'))).to.be.rejectedWith(BANNED)
      await expect(joinGroup(restricted.id, person.id, [], null, invitation.get('token'))).to.be.rejectedWith(BANNED)
      expect(await isActiveMember(person, restricted)).to.be.false
      expect((await Invitation.find(invitation.id)).get('used_by_id')).to.not.exist
    })

    it("refuses an invitation to one of the group's spaces", async () => {
      const space = await factories.group({ type: 'space', parent_id: restricted.id }).save()
      const person = await removedAndBlocked(restricted)
      const invitation = await Invitation.create({ userId: steward.id, groupId: space.id, email: person.get('email') })
      await expect(InvitationService.use(person.id, invitation.get('token'))).to.be.rejectedWith(BANNED)
      expect(await isActiveMember(person, space)).to.be.false
    })

    it("refuses a member invitation and a member's invite link", async () => {
      await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
        await GroupRole.setInvitePolicy(open.id, { mode: 'everyone' })
        const person = await removedAndBlocked(open)
        const memberInvitation = await Invitation.create({
          userId: member.id, groupId: open.id, email: person.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED
        })
        await expect(InvitationService.use(person.id, memberInvitation.get('token'))).to.be.rejectedWith(BANNED)

        const link = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: member.id })
        await expect(InvitationService.use(person.id, null, link.get('code'))).to.be.rejectedWith(BANNED)
        await expect(joinGroup(open.id, person.id, [], link.get('code'))).to.be.rejectedWith(BANNED)
        expect(await isActiveMember(person, open)).to.be.false
      })
    })

    it('lets people who were never blocked, and members already in, through', async () => {
      const newcomer = await factories.user().save()
      const membership = await InvitationService.use(newcomer.id, null, restricted.get('access_code'))
      expect(membership.get('active')).to.be.true
      const again = await InvitationService.use(member.id, null, restricted.get('access_code'))
      expect(again.get('active')).to.be.true
    })
  })

  describe('lifting a block', () => {
    it('opens every route again', async () => {
      const person = await removedAndBlocked(restricted)
      expect(await liftGroupBan(steward.id, person.id, restricted.id)).to.deep.equal({ success: true })
      expect(await GroupBan.isBanned(person.id, restricted.id)).to.be.false
      const membership = await InvitationService.use(person.id, null, restricted.get('access_code'))
      expect(membership.get('active')).to.be.true

      const openPerson = await removedAndBlocked(open)
      await liftGroupBan(steward.id, openPerson.id, open.id)
      expect((await joinGroup(open.id, openPerson.id, [])).get('active')).to.be.true
    })

    it('keeps the record of the lifted block and says when there was none to lift', async () => {
      const person = await removedAndBlocked(open)
      await liftGroupBan(steward.id, person.id, open.id)
      const row = await bookshelf.knex('group_bans').where({ group_id: open.id, user_id: person.id }).first()
      expect(row.lifted_at).to.exist
      expect(String(row.lifted_by_id)).to.equal(String(steward.id))
      expect(await liftGroupBan(steward.id, person.id, open.id)).to.deep.equal({ success: false })
    })

    it('only lets people who can add or remove members lift a block', async () => {
      const person = await removedAndBlocked(open)
      await expect(liftGroupBan(member.id, person.id, open.id)).to.be.rejectedWith("You don't have the right responsibilities for this group")
      expect(await GroupBan.isBanned(person.id, open.id)).to.be.true
    })
  })

  describe('Group.blockedFromRejoining', () => {
    let handler

    const blockedAs = async (user, group) => {
      const req = factories.mock.request()
      req.url = '/noo/graphql'
      req.method = 'POST'
      req.headers = { 'Content-Type': 'application/json' }
      req.session = { userId: user.id, destroy: () => {} }
      const { executionResult } = await handler.inject({
        document: `{ group(id: ${group.id}) { blockedFromRejoining { id person { id name } createdBy { id } createdAt } } }`,
        serverContext: { req, res: factories.mock.response() }
      })
      expect(executionResult.errors).to.be.undefined
      return executionResult.data.group.blockedFromRejoining
    }

    before(() => { handler = createRequestHandler() })

    it('lists the blocks in force to stewards only', async () => {
      const listGroup = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      await assignAdministrator(steward, listGroup)
      await member.joinGroup(listGroup)
      const blocked = await removedAndBlocked(listGroup)
      const lifted = await removedAndBlocked(listGroup)
      await liftGroupBan(steward.id, lifted.id, listGroup.id)

      const list = await blockedAs(steward, listGroup)
      expect(list.map(ban => ban.person.id)).to.deep.equal([String(blocked.id)])
      expect(list[0].createdBy.id).to.equal(String(steward.id))
      expect(await blockedAs(member, listGroup)).to.deep.equal([])
    })
  })

  describe('joining with agreements and join questions answered on the about page', () => {
    it('records that the join questions were answered and the agreements accepted', async () => {
      const group = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const agreement = await Agreement.forge({ title: 'Be kind', description: 'Please' }).save()
      await GroupAgreement.forge({ group_id: group.id, agreement_id: agreement.id }).save()
      const question = await Question.forge({ text: 'Why?' }).save()
      await GroupJoinQuestion.forge({ group_id: group.id, question_id: question.id }).save()
      const person = await factories.user().save()

      const membership = await joinGroup(group.id, person.id, [{ questionId: question.id, answer: 'To help' }], null, null, true)

      expect(membership.getSetting('joinQuestionsAnsweredAt')).to.exist
      expect(membership.getSetting('agreementsAcceptedAt')).to.exist
      const saved = await GroupMembership.forPair(person.id, group.id).fetch()
      expect(saved.getSetting('joinQuestionsAnsweredAt')).to.exist
      expect(saved.getSetting('showJoinForm')).to.equal(true)
    })

    it('records the join questions as done even for a group that asks none', async () => {
      const group = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
      const person = await factories.user().save()
      const membership = await joinGroup(group.id, person.id, [], null, null, true)
      expect(membership.getSetting('joinQuestionsAnsweredAt')).to.exist
    })
  })
})
