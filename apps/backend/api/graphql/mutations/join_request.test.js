import '../../../test/setup'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createJoinRequest,
  acceptJoinRequest,
  cancelJoinRequest,
  declineJoinRequest
} from './join_request'

/** Gives user Coordinator common role in group (includes Add Members). */
async function assignCoordinator (user, group) {
  await user.joinGroup(group)
  await new MemberCommonRole({
    user_id: user.id,
    group_id: group.id,
    common_role_id: CommonRole.ROLES.Coordinator
  }).save()
}

describe('join_request mutations', () => {
  let group, applicant, moderator, outsider

  before(async () => {
    group = await factories.group().save()
    applicant = await factories.user().save()
    moderator = await factories.user().save()
    outsider = await factories.user().save()
    await assignCoordinator(moderator, group)
  })

  after(async () => setup.clearDb())

  describe('createJoinRequest', () => {
    it('creates a pending join request', async () => {
      const result = await createJoinRequest(applicant.id, group.id, [])
      expect(result.request.get('status')).to.equal(JoinRequest.STATUS.Pending)
      expect(result.request.get('user_id')).to.equal(applicant.id)
      expect(result.request.get('group_id')).to.equal(group.id)
    })

    it('returns the existing pending request instead of creating a duplicate', async () => {
      const first = await createJoinRequest(applicant.id, group.id, [])
      const second = await createJoinRequest(applicant.id, group.id, [])
      expect(second.request.id).to.equal(first.request.id)
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
      await acceptJoinRequest(moderator.id, jr.request.id)
      const refreshed = await JoinRequest.find(jr.request.id)
      expect(refreshed.get('status')).to.equal(JoinRequest.STATUS.Accepted)
      const gm = await GroupMembership.forPair(requester.id, group.id).fetch()
      expect(gm).to.exist
    })

    it('rejects when user cannot add members', async () => {
      const g2 = await factories.group().save()
      const requester = await factories.user().save()
      await assignCoordinator(moderator, g2)
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
      await assignCoordinator(moderator, g5)
      const requester = await factories.user().save()
      const jr = await createJoinRequest(requester.id, g5.id, [])
      const declined = await declineJoinRequest(moderator.id, jr.request.id)
      expect(declined.get('status')).to.equal(JoinRequest.STATUS.Rejected)
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
})
