/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import InvitationService from '../../services/InvitationService'
import {
  createJoinRequest,
  acceptJoinRequest,
  cancelJoinRequest,
  declineJoinRequest
} from './join_request'

describe('join_request mutations', () => {
  let group, applicant, moderator, outsider

  before(async () => {
    group = await factories.group().save()
    applicant = await factories.user().save()
    moderator = await factories.user().save()
    outsider = await factories.user().save()
    await assignAdministrator(moderator, group)
  })

  after(async function () {
    this.timeout(10000)
    await setup.clearDb()
  })

  describe('createJoinRequest', () => {
    it('creates a pending join request', async () => {
      const result = await createJoinRequest(applicant.id, group.id, [])
      expect(result.request.get('status')).to.equal(JoinRequest.STATUS.Pending)
      expect(result.request.get('user_id')).to.equal(applicant.id)
      expect(result.request.get('group_id')).to.equal(group.id)
      await group.refresh()
      expect(group.get('num_open_join_requests')).to.equal(1)
    })

    it('returns the existing pending request instead of creating a duplicate', async () => {
      const first = await createJoinRequest(applicant.id, group.id, [])
      const second = await createJoinRequest(applicant.id, group.id, [])
      expect(second.request.id).to.equal(first.request.id)
      await group.refresh()
      expect(group.get('num_open_join_requests')).to.equal(1)
    })

    it('throws when parameters are invalid', async () => {
      try {
        await createJoinRequest(null, group.id, [])
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/Invalid parameters/)
      }
    })
  })

  describe('acceptJoinRequest', () => {
    it('accepts when moderator has Add Members responsibility', async () => {
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, group.id, [])
      await group.refresh()
      const countBeforeAccept = group.get('num_open_join_requests')
      await acceptJoinRequest(moderator.id, jr.request.id)
      const refreshed = await JoinRequest.find(jr.request.id)
      expect(refreshed.get('status')).to.equal(JoinRequest.STATUS.Accepted)
      const gm = await GroupMembership.forPair(requester.id, group.id).fetch()
      expect(gm).to.exist
      await group.refresh()
      expect(group.get('num_open_join_requests')).to.equal(countBeforeAccept - 1)
    })

    it('rejects when user cannot add members', async () => {
      const g2 = await factories.group().save()
      const requester = await factories.user().save()
      await assignAdministrator(moderator, g2)
      const jr = await createJoinRequest(requester.id, g2.id, [])
      try {
        await acceptJoinRequest(outsider.id, jr.request.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })

    it('throws when join request is missing', async () => {
      try {
        await acceptJoinRequest(moderator.id, 999999999)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/Invalid parameters/)
      }
    })

    it('marks agreements and join questions complete so the welcome modal does not re-ask', async () => {
      const g = await factories.group().save()
      await assignAdministrator(moderator, g)
      await g.update({
        agreements: [{ title: 'Be kind', description: 'Please be kind' }],
        join_questions: [{ text: 'Why do you want to join?' }]
      }, moderator.id)

      const joinQuestions = await g.joinQuestions().fetch()
      expect(joinQuestions.length).to.equal(1)
      const questionId = joinQuestions.models[0].get('question_id') || joinQuestions.models[0].get('questionId')

      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g.id, [
        { questionId, answer: 'To help out' }
      ])
      await acceptJoinRequest(moderator.id, jr.request.id)

      const gm = await GroupMembership.forPair(requester.id, g.id).fetch()
      expect(gm.getSetting('joinQuestionsAnsweredAt')).to.exist
      expect(gm.getSetting('agreementsAcceptedAt')).to.exist
      expect(gm.getSetting('showJoinForm')).to.equal(true)

      const acceptedAgreements = await UserGroupAgreement.where({
        user_id: requester.id,
        group_id: g.id
      }).fetchAll()
      expect(acceptedAgreements.length).to.be.above(0)
      expect(acceptedAgreements.models[0].get('accepted')).to.equal(true)
    })
  })

  describe('cancelJoinRequest', () => {
    it('allows the requester to cancel', async () => {
      const g3 = await factories.group().save()
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g3.id, [])
      const out = await cancelJoinRequest(requester.id, jr.request.id)
      expect(out.success).to.equal(true)
      const refreshed = await JoinRequest.find(jr.request.id)
      expect(refreshed.get('status')).to.equal(JoinRequest.STATUS.Canceled)
      await g3.refresh()
      expect(g3.get('num_open_join_requests')).to.equal(0)
    })

    it('rejects when another user tries to cancel', async () => {
      const g4 = await factories.group().save()
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g4.id, [])
      try {
        await cancelJoinRequest(outsider.id, jr.request.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })
  })

  describe('declineJoinRequest', () => {
    it('allows a moderator to decline', async () => {
      const g5 = await factories.group().save()
      await assignAdministrator(moderator, g5)
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g5.id, [])
      const declined = await declineJoinRequest(moderator.id, jr.request.id)
      expect(declined.get('status')).to.equal(JoinRequest.STATUS.Rejected)
      await g5.refresh()
      expect(g5.get('num_open_join_requests')).to.equal(0)
    })

    it('rejects when user is not a moderator', async () => {
      const g6 = await factories.group().save()
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g6.id, [])
      try {
        await declineJoinRequest(outsider.id, jr.request.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })
  })

  describe('requests from member invitations', () => {
    let restricted, otherGroup, admin, sponsor

    const memberInvitation = ({ email = `invitee-${Date.now()}-${Math.random()}@sponsored.com`, groupId = restricted.id, inviterAccess = Invitation.InviterAccess.LIMITED } = {}) =>
      Invitation.create({ userId: sponsor.id, groupId, email, inviterAccess })

    const noRequestFrom = async requester =>
      expect(await JoinRequest.where({ user_id: requester.id, group_id: restricted.id }).fetch()).to.not.exist

    before(async () => {
      restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      otherGroup = await factories.group().save()
      admin = await factories.user().save()
      sponsor = await factories.user().save()
      await admin.joinGroup(restricted, { assignAdministrator: true })
      await sponsor.joinGroup(restricted)
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
    })

    it('links the member invitation whose token the requester followed', async () => {
      const requester = await factories.user().save()
      const invitation = await memberInvitation()
      const { request } = await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))
      expect(request.get('invitation_id')).to.equal(invitation.id)
    })

    it('links the invitation to a request the person already made', async () => {
      const requester = await factories.user().save()
      const first = await createJoinRequest(requester.id, restricted.id, [])
      expect(first.request.get('invitation_id')).to.be.null

      const invitation = await memberInvitation()
      const second = await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))
      expect(second.request.id).to.equal(first.request.id)
      expect((await JoinRequest.find(first.request.id)).get('invitation_id')).to.equal(invitation.id)
    })

    it('refuses a token that is not a pending member invitation to this group', async () => {
      const used = await memberInvitation()
      await used.save({ used_by_id: admin.id, used_at: new Date() }, { patch: true })
      const expired = await memberInvitation()
      await expired.expire(sponsor.id)
      const otherGroupInvitation = await memberInvitation({ groupId: otherGroup.id })
      const stewardInvitation = await memberInvitation({ inviterAccess: Invitation.InviterAccess.FULL })

      for (const token of ['not-a-token', used.get('token'), expired.get('token'), otherGroupInvitation.get('token'), stewardInvitation.get('token')]) {
        const requester = await factories.user().save()
        await expect(createJoinRequest(requester.id, restricted.id, [], token))
          .to.be.rejectedWith('This invitation cannot be used to request to join this group')
        await noRequestFrom(requester)
      }
    })

    it('without a token, links a pending member invitation to the requester\'s email address', async () => {
      const requester = await factories.user({ email: `Mixed.Case.${Date.now()}@Sponsored.com` }).save()
      const email = requester.get('email')
      await memberInvitation({ email, inviterAccess: Invitation.InviterAccess.FULL })
      const expired = await memberInvitation({ email })
      await expired.expire(sponsor.id)
      const pending = await memberInvitation({ email })
      await memberInvitation({ email, groupId: otherGroup.id })

      const { request } = await createJoinRequest(requester.id, restricted.id, [])
      expect(request.get('invitation_id')).to.equal(pending.id)

      const stewardInvitee = await factories.user().save()
      await memberInvitation({ email: stewardInvitee.get('email'), inviterAccess: Invitation.InviterAccess.FULL })
      const unlinked = await createJoinRequest(stewardInvitee.id, restricted.id, [])
      expect(unlinked.request.get('invitation_id')).to.be.null
    })

    it('notifies people with Add Members, not the member who sent the invitation', async () => {
      const requester = await factories.user().save()
      const invitation = await memberInvitation()
      await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))

      const notified = async reader => {
        const activities = await Activity.where({ reader_id: reader.id, actor_id: requester.id, group_id: restricted.id }).fetchAll()
        return activities.some(a => (a.get('meta')?.reasons || []).includes('joinRequest'))
      }
      expect(await notified(admin)).to.be.true
      expect(await notified(sponsor)).to.be.false
    })

    it('does not let limited invite access accept or decline requests', async () => {
      expect(await GroupMembership.inviteAccess(sponsor.id, restricted.id)).to.equal(GroupMembership.InviteAccess.LIMITED)
      const requester = await factories.user().save()
      const invitation = await memberInvitation()
      const { request } = await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))

      await expect(acceptJoinRequest(sponsor.id, request.id)).to.be.rejectedWith('You do not have permission to accept a join request')
      await expect(declineJoinRequest(sponsor.id, request.id)).to.be.rejectedWith('You do not have permission to do this')
      expect((await JoinRequest.find(request.id)).get('status')).to.equal(JoinRequest.STATUS.Pending)
      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.be.null
      expect(invitation.get('expired_by_id')).to.be.null
    })

    it('marks the invitation used on acceptance, whatever address the requester has, and records who accepted', async () => {
      const requester = await factories.user().save()
      const invitation = await memberInvitation({ email: 'a-different-address@sponsored.com' })
      const { request } = await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))

      await acceptJoinRequest(admin.id, request.id)

      const accepted = await JoinRequest.find(request.id)
      expect(accepted.get('status')).to.equal(JoinRequest.STATUS.Accepted)
      expect(accepted.get('processed_by_id')).to.equal(admin.id)
      expect(await GroupMembership.forPair(requester.id, restricted.id).fetch()).to.exist
      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.equal(requester.id)
      expect(invitation.get('used_at')).to.exist
      expect(invitation.get('expired_by_id')).to.be.null
    })

    it('expires the invitation when the request is declined, and records who declined', async () => {
      const requester = await factories.user().save()
      const invitation = await memberInvitation()
      const { request } = await createJoinRequest(requester.id, restricted.id, [], invitation.get('token'))

      await declineJoinRequest(admin.id, request.id)

      const declined = await JoinRequest.find(request.id)
      expect(declined.get('status')).to.equal(JoinRequest.STATUS.Rejected)
      expect(declined.get('processed_by_id')).to.equal(admin.id)
      await invitation.refresh()
      expect(invitation.get('expired_by_id')).to.equal(admin.id)
      expect(invitation.get('used_by_id')).to.be.null
      await expect(createJoinRequest(requester.id, restricted.id, [], invitation.get('token')))
        .to.be.rejectedWith('This invitation cannot be used to request to join this group')
    })
  })

  describe("requests from members' personal invite links", () => {
    let restricted, otherGroup, admin, owner, link

    const ledgerTotal = async userId => {
      const row = await bookshelf.knex('invitation_sends').where({ user_id: userId }).sum('recipients as total').first()
      return Number(row.total || 0)
    }
    const noRequestFrom = async requester =>
      expect(await JoinRequest.where({ user_id: requester.id, group_id: restricted.id }).fetch()).to.not.exist

    before(async () => {
      restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      otherGroup = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
      admin = await factories.user().save()
      owner = await factories.user({ name: 'Link Owner' }).save()
      await admin.joinGroup(restricted, { assignAdministrator: true })
      await owner.joinGroup(restricted)
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
      link = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: owner.id })
    })

    it('records the link, counts the person toward its owner\'s day, and says who invited them', async () => {
      const requester = await factories.user().save()
      const before = await ledgerTotal(owner.id)
      const { request } = await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))

      expect(request.get('member_invite_link_id')).to.equal(link.id)
      expect(request.get('invitation_id')).to.be.null
      expect(await ledgerTotal(owner.id)).to.equal(before + 1)
      expect(String(await request.sponsorId())).to.equal(String(owner.id))
      const shown = await InvitationService.memberLinkSender(await request.memberInviteLink().fetch())
      expect(shown).to.deep.equal({ id: owner.id, name: 'Link Owner', avatarUrl: owner.get('avatar_url') || null })
    })

    it('adds the link to a request the person already made, counting them once', async () => {
      const requester = await factories.user().save()
      const first = await createJoinRequest(requester.id, restricted.id, [])
      const before = await ledgerTotal(owner.id)
      const second = await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))
      expect(second.request.id).to.equal(first.request.id)
      expect((await JoinRequest.find(first.request.id)).get('member_invite_link_id')).to.equal(link.id)
      await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))
      expect(await ledgerTotal(owner.id)).to.equal(before + 1)
    })

    it('counts someone who cancels and asks again through the same link only once a day', async () => {
      const requester = await factories.user().save()
      const before = await ledgerTotal(owner.id)
      const first = await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))
      await cancelJoinRequest(requester.id, first.request.id)
      const second = await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))
      expect(second.request.id).to.not.equal(first.request.id)
      expect(second.request.get('member_invite_link_id')).to.equal(link.id)
      expect(await ledgerTotal(owner.id)).to.equal(before + 1)
    })

    it('does not count someone who is already in the group', async () => {
      const member = await factories.user().save()
      await member.joinGroup(restricted)
      const before = await ledgerTotal(owner.id)
      await createJoinRequest(member.id, restricted.id, [], null, link.get('code'))
      expect(await ledgerTotal(owner.id)).to.equal(before)
    })

    it('refuses a code that is not a usable member link to this group', async () => {
      const otherOwner = await factories.user().save()
      await otherOwner.joinGroup(otherGroup)
      await GroupRole.setInvitePolicy(otherGroup.id, { mode: 'everyone' })
      const otherGroupLink = await MemberInviteLink.findOrCreate({ groupId: otherGroup.id, userId: otherOwner.id })
      const resetOwner = await factories.user().save()
      await resetOwner.joinGroup(restricted)
      const oldLink = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: resetOwner.id })
      await MemberInviteLink.reset({ groupId: restricted.id, userId: resetOwner.id })

      for (const code of ['not-a-code', otherGroupLink.get('code'), oldLink.get('code'), restricted.get('access_code')]) {
        const requester = await factories.user().save()
        await expect(createJoinRequest(requester.id, restricted.id, [], null, code))
          .to.be.rejectedWith('This invitation cannot be used to request to join this group')
        await noRequestFrom(requester)
      }
    })

    it('asks nobody in while the owner\'s allowance is used up', async () => {
      const busyOwner = await factories.user().save()
      await busyOwner.joinGroup(restricted)
      const busyLink = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: busyOwner.id })
      await bookshelf.knex('invitation_sends').insert({ user_id: busyOwner.id, group_id: restricted.id, recipients: InvitationSend.LIMITS.perInviterPerDay })
      const requester = await factories.user().save()
      await expect(createJoinRequest(requester.id, restricted.id, [], null, busyLink.get('code')))
        .to.be.rejectedWith(InvitationService.MEMBER_LINK_TRY_LATER)
      await noRequestFrom(requester)
    })

    it('records who invited the person when a steward welcomes them', async () => {
      const requester = await factories.user().save()
      const { request } = await createJoinRequest(requester.id, restricted.id, [], null, link.get('code'))
      await acceptJoinRequest(admin.id, request.id)
      const membership = await GroupMembership.forPair(requester.id, restricted.id).fetch()
      expect(membership.getSetting('joinSource')).to.equal('join_request')
      expect(String(membership.getSetting('invitedById'))).to.equal(String(owner.id))
    })
  })

  describe('space join requests', () => {
    let parentGroup, space, parentSteward

    before(async () => {
      parentGroup = await factories.group({ name: 'Parent Group' }).save()
      space = await factories.group({
        name: 'The Space',
        type: 'space',
        parent_id: parentGroup.id,
        slug: `space-jr-${Date.now()}`
      }).save()
      parentSteward = await factories.user().save()
      await assignAdministrator(parentSteward, parentGroup)
    })

    it('notifies parent administrators who are not space members', async () => {
      const spaceRequester = await factories.user().save()
      await createJoinRequest(spaceRequester.id, space.id, [])
      const activities = await Activity.where({
        reader_id: parentSteward.id,
        group_id: space.id
      }).fetchAll()
      const joinRequestActivity = activities.find(a => {
        const reasons = a.get('meta')?.reasons || []
        return reasons.includes('joinRequest')
      })
      expect(joinRequestActivity).to.exist
      expect(String(joinRequestActivity.get('other_group_id'))).to.equal(String(parentGroup.id))
      expect(String(joinRequestActivity.get('actor_id'))).to.equal(String(spaceRequester.id))
      const notifications = await Notification.where({
        activity_id: joinRequestActivity.id,
        user_id: parentSteward.id
      }).fetchAll()
      expect(notifications.length).to.be.at.least(1)
    })

    it('lets a parent administrator accept without space membership', async () => {
      const spaceRequester = await factories.user().save()
      const { request } = await createJoinRequest(spaceRequester.id, space.id, [])
      await acceptJoinRequest(parentSteward.id, request.id)
      const refreshed = await JoinRequest.find(request.id)
      expect(refreshed.get('status')).to.equal(JoinRequest.STATUS.Accepted)
    })
  })
})
