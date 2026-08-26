/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignCoordinator } from '../../../test/setup/roleHelpers'
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
    await assignCoordinator(moderator, group)
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
      await assignCoordinator(moderator, g5)
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
      await assignCoordinator(parentSteward, parentGroup)
    })

    it('notifies parent coordinators who are not space members', async () => {
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

    it('lets a parent coordinator accept without space membership', async () => {
      const spaceRequester = await factories.user().save()
      const { request } = await createJoinRequest(spaceRequester.id, space.id, [])
      await acceptJoinRequest(parentSteward.id, request.id)
      const refreshed = await JoinRequest.find(request.id)
      expect(refreshed.get('status')).to.equal(JoinRequest.STATUS.Accepted)
    })
  })
})
