/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { withFeatureFlag } from '../../../test/setup/helpers'
import { liftGroupBan, removeMember } from './group'
import { acceptJoinRequest, createJoinRequest } from './join_request'

const BANNED = "You can't join this group"

describe('join requests from people blocked from rejoining', () => {
  let steward, sponsor, restricted

  const requestsFrom = person => JoinRequest.where({ user_id: person.id, group_id: restricted.id }).count()

  // A member of the group whom the steward then removes and blocks
  const removedAndBlocked = async () => {
    const person = await factories.user().save()
    await person.joinGroup(restricted)
    await removeMember(steward.id, person.id, restricted.id, {}, { blockFromRejoining: true })
    return person
  }

  before(async () => {
    steward = await factories.user().save()
    sponsor = await factories.user().save()
    restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
    await assignAdministrator(steward, restricted)
    await sponsor.joinGroup(restricted)
  })

  after(async function () {
    this.timeout(10000)
    await setup.clearDb()
  })

  it('refuses a request to join', async () => {
    const person = await removedAndBlocked()
    await expect(createJoinRequest(person.id, restricted.id, [])).to.be.rejectedWith(BANNED)
    expect(Number(await requestsFrom(person))).to.equal(0)
  })

  it("refuses a request through a member invitation or a member's invite link", async () => {
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
      const person = await removedAndBlocked()
      const invitation = await Invitation.create({
        userId: sponsor.id, groupId: restricted.id, email: person.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED
      })
      await expect(createJoinRequest(person.id, restricted.id, [], invitation.get('token'))).to.be.rejectedWith(BANNED)

      const link = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: sponsor.id })
      const spentBefore = await bookshelf.knex('invitation_sends').where({ user_id: sponsor.id }).sum('recipients as total').first()
      await expect(createJoinRequest(person.id, restricted.id, [], null, link.get('code'))).to.be.rejectedWith(BANNED)
      const spentAfter = await bookshelf.knex('invitation_sends').where({ user_id: sponsor.id }).sum('recipients as total').first()
      expect(Number(spentAfter.total || 0)).to.equal(Number(spentBefore.total || 0))
      expect(Number(await requestsFrom(person))).to.equal(0)
    })
  })

  it('tells a steward to lift the block before accepting a request left from before it', async () => {
    const person = await factories.user().save()
    const { request } = await createJoinRequest(person.id, restricted.id, [])
    await GroupBan.create({ groupId: restricted.id, userId: person.id, createdById: steward.id })

    await expect(acceptJoinRequest(steward.id, request.id)).to.be.rejectedWith(GroupBan.BANNED_REQUEST_ERROR)
    expect((await JoinRequest.find(request.id)).get('status')).to.equal(JoinRequest.STATUS.Pending)

    await liftGroupBan(steward.id, person.id, restricted.id)
    await acceptJoinRequest(steward.id, request.id)
    expect((await JoinRequest.find(request.id)).get('status')).to.equal(JoinRequest.STATUS.Accepted)
    expect(await GroupMembership.forPair(person.id, restricted.id).fetch()).to.exist
  })

  it('takes requests again once the block is lifted', async () => {
    const person = await removedAndBlocked()
    await liftGroupBan(steward.id, person.id, restricted.id)
    const { request } = await createJoinRequest(person.id, restricted.id, [])
    expect(request.get('status')).to.equal(JoinRequest.STATUS.Pending)
  })
})
