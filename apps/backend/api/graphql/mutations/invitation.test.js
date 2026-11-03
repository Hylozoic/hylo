/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { joinGroup } from './group'
import { createInvitation, expireInvitation, reinviteAll, resendInvitation } from './invitation'

const MEMBER_ROLE_ERROR = 'The All Members role cannot be edited, assigned or used as a requirement'
const NO_PERMISSION = "You don't have permission to create an invitation for this group"

describe('invitation mutation', () => {
  let user, group

  before(function () {
    user = factories.user()
    group = factories.group()
    return Promise.join(group.save(), user.save())
      .then(() => user.joinGroup(group, { assignAdministrator: true }))
  })

  it('createInvitation successfully', () => {
    const data = { emails: ['one@test.com', 'two@test.com'], assignAdministrator: true }
    return createInvitation(user.id, group.id, data)
      .then((ret) => expect(ret.invitations).to.have.lengthOf(2))
  })

  it('createInvitation ignores a custom message and uses the default', () => {
    const data = { emails: ['three@test.com'], message: 'custom override' }
    return createInvitation(user.id, group.id, data)
      .then(async (ret) => {
        const invitation = await Invitation.find(ret.invitations[0].id)
        expect(invitation.get('message')).to.not.include('custom override')
        expect(invitation.get('message')).to.include(group.get('name'))
      })
  })

  it('createInvitation rejects the Member role', async () => {
    const memberRole = await GroupRole.findAllMembersRole(group.id)
    const email = `member-role-${Date.now()}@test.com`
    await expect(createInvitation(user.id, group.id, { emails: [email], groupRoleId: String(memberRole.id) }))
      .to.be.rejectedWith(MEMBER_ROLE_ERROR)
    const invitations = await Invitation.where({ group_id: group.id, email }).count()
    expect(Number(invitations)).to.equal(0)
  })
})

describe('member invitations', () => {
  let admin, queued
  let counter = 0

  const addresses = (prefix, n) => Array.from({ length: n }, () => `${prefix}-${++counter}@example.com`)
  const settle = calls => Promise.all(calls.map(call => call.then(() => 'sent', err => err.message)))

  const createGroup = async (mode = 'everyone') => {
    const group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await GroupRole.setInvitePolicy(group.id, mode)
    return group
  }

  const createMember = async group => {
    const member = await factories.user().save()
    await member.joinGroup(group)
    return member
  }

  const invitesBy = (userId, groupId) => Invitation.query(q => {
    q.where({ invited_by_id: userId, group_id: groupId })
    q.orderBy('id')
  }).fetchAll().then(invitations => invitations.models)

  const ledgerTotal = async where => {
    const row = await bookshelf.knex('invitation_sends').where(where).sum('recipients as total').first()
    return Number(row.total || 0)
  }

  const queuedInvitationIds = () => queued
    .filter(([cls, method]) => cls === 'Invitation' && method === 'createAndSend')
    .map(([, , { invitation }]) => invitation.id)

  before(async () => {
    admin = await factories.user().save()
    mockify(Queue, 'classMethod', (cls, method, data) => {
      queued.push([cls, method, data])
      return Promise.resolve()
    })
  })

  beforeEach(() => {
    queued = []
  })

  after(() => unspyify(Queue, 'classMethod'))

  describe('createInvitation', () => {
    it('lets members invite by email when the policy is everyone, and not under stewards', async () => {
      const group = await createGroup('stewards')
      const member = await createMember(group)
      const [email] = addresses('policy', 1)

      await expect(createInvitation(member.id, group.id, { emails: [email] })).to.be.rejectedWith(NO_PERMISSION)

      await GroupRole.setInvitePolicy(group.id, 'everyone')
      const result = await createInvitation(member.id, group.id, { emails: [email] })
      expect(result.invitations.map(invitation => invitation.email)).to.deep.equal([email])
      expect(result.invitations[0].id).to.exist

      const invitations = await invitesBy(member.id, group.id)
      expect(invitations.map(i => i.get('email'))).to.deep.equal([email])
      expect(invitations[0].get('message')).to.include(group.get('name'))
      expect(queuedInvitationIds()).to.deep.equal([invitations[0].id])
    })

    it('rejects roles and still lets members invite people by id and to a space', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      const other = await createMember(group)
      const host = await GroupRole.findSystemRole(group.id, 'Host')
      const space = await factories.group({ type: 'space', parent_id: group.id }).save()
      await member.joinGroup(space)
      const emails = addresses('rejected', 1)

      await expect(createInvitation(member.id, group.id, { emails, groupRoleId: String(host.id) }))
        .to.be.rejectedWith("You don't have permission to invite people with a role")
      await expect(createInvitation(member.id, group.id, { emails, assignAdministrator: true }))
        .to.be.rejectedWith("You don't have permission to invite people with a role")

      const byId = await createInvitation(member.id, group.id, { userIds: [other.id] })
      expect(byId.invitations[0].email.toLowerCase()).to.equal(other.get('email').toLowerCase())
      const toSpace = await createInvitation(member.id, space.id, { emails })
      expect(toSpace.invitations[0].id).to.exist

      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(1)
      expect(await invitesBy(member.id, space.id)).to.have.lengthOf(1)
    })

    it('takes at most 10 different valid addresses at a time', async () => {
      const group = await createGroup()
      const member = await createMember(group)

      await expect(createInvitation(member.id, group.id, { emails: addresses('eleven', 11) }))
        .to.be.rejectedWith('You can invite up to 10 people at a time')
      expect(await ledgerTotal({ user_id: member.id })).to.equal(0)

      const ten = addresses('ten', 10)
      const typed = [...ten, 'not-an-email', '']
      const result = await createInvitation(member.id, group.id, { emails: typed })
      expect(result.invitations.map(invitation => invitation.email)).to.deep.equal([...ten, 'not-an-email', ''])
      expect(result.invitations[10].error).to.equal('not a valid email address')
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(10)
      expect(await ledgerTotal({ user_id: member.id })).to.equal(10)
    })

    it('reports members, invited people and the sender as sent without inviting them, and counts them', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      const existing = await createMember(group)
      const [invitedByAdmin, invitedByMember, fresh] = addresses('skip', 3)
      await Invitation.create({ userId: admin.id, groupId: group.id, email: invitedByAdmin })
      await createInvitation(member.id, group.id, { emails: [invitedByMember] })
      queued = []

      const typed = [existing.get('email').toUpperCase(), invitedByAdmin, invitedByMember, member.get('email'), fresh]
      const result = await createInvitation(member.id, group.id, { emails: typed })
      expect(result.invitations.map(invitation => invitation.email.toLowerCase())).to.deep.equal(typed.map(email => email.toLowerCase()))

      const invitations = await invitesBy(member.id, group.id)
      expect(invitations.map(i => i.get('email'))).to.include.members([invitedByMember, fresh, existing.get('email').toLowerCase()])
      expect(invitations).to.have.lengthOf(6)
      expect(queuedInvitationIds()).to.have.lengthOf(5)
      expect(await ledgerTotal({ user_id: member.id, group_id: group.id })).to.equal(6)
      expect(await InvitationSend.remainingAllowance({ userId: member.id, groupId: group.id })).to.equal(94)
    })

    it('allows 100 addresses per sender and 200 per group in any 24 hours', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      await bookshelf.knex('invitation_sends').insert({ user_id: member.id, group_id: group.id, recipients: 90 })

      await createInvitation(member.id, group.id, { emails: addresses('sender', 10) })
      await expect(createInvitation(member.id, group.id, { emails: addresses('sender', 10) })).to.be.rejectedWith('invite-limit')
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(10)
      expect(await InvitationSend.remainingAllowance({ userId: member.id, groupId: group.id })).to.equal(0)

      const busyGroup = await createGroup()
      const sender = await createMember(busyGroup)
      await bookshelf.knex('invitation_sends').insert({ user_id: admin.id, group_id: busyGroup.id, recipients: 195 })
      await expect(createInvitation(sender.id, busyGroup.id, { emails: addresses('group', 10) })).to.be.rejectedWith('invite-limit')
      await createInvitation(sender.id, busyGroup.id, { emails: addresses('group', 5) })
      expect(await invitesBy(sender.id, busyGroup.id)).to.have.lengthOf(5)
      expect(await ledgerTotal({ group_id: busyGroup.id })).to.equal(200)
      expect(await InvitationSend.remainingAllowance({ userId: sender.id, groupId: busyGroup.id })).to.equal(0)
    })

    it('never goes over either limit when sends run at the same time', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      await bookshelf.knex('invitation_sends').insert({ user_id: member.id, group_id: group.id, recipients: 80 })
      const outcomes = await settle(Array.from({ length: 5 }, () =>
        createInvitation(member.id, group.id, { emails: addresses('parallel', 10) })))
      expect(outcomes.sort()).to.deep.equal(['invite-limit', 'invite-limit', 'invite-limit', 'sent', 'sent'])
      expect(await ledgerTotal({ user_id: member.id })).to.equal(100)
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(20)

      const busyGroup = await createGroup()
      await bookshelf.knex('invitation_sends').insert({ user_id: admin.id, group_id: busyGroup.id, recipients: 180 })
      const senders = await Promise.all(Array.from({ length: 5 }, () => createMember(busyGroup)))
      const groupOutcomes = await settle(senders.map(sender =>
        createInvitation(sender.id, busyGroup.id, { emails: addresses('parallel-group', 10) })))
      expect(groupOutcomes.sort()).to.deep.equal(['invite-limit', 'invite-limit', 'invite-limit', 'sent', 'sent'])
      expect(await ledgerTotal({ group_id: busyGroup.id })).to.equal(200)
      const created = await Invitation.where({ group_id: busyGroup.id }).count()
      expect(Number(created)).to.equal(20)
    })

    it('counts invitations from administrators against the same limits', async () => {
      const steward = await factories.user().save()
      const group = await factories.group().save()
      await steward.joinGroup(group, { assignAdministrator: true })
      const [email] = addresses('steward', 1)
      const result = await createInvitation(steward.id, group.id, { emails: [email] })
      const [invitation] = result.invitations
      expect(invitation.id).to.exist
      expect(await ledgerTotal({ user_id: steward.id, group_id: group.id })).to.equal(1)
    })
  })

  describe('useInvitation', () => {
    it('does not let joinGroup skip the prerequisite groups of an Open group', async () => {
      const group = await createGroup()
      await group.save({ accessibility: Group.Accessibility.OPEN }, { patch: true })
      const prerequisite = await factories.group().save()
      await GroupRelationship.forge({
        parent_group_id: prerequisite.id,
        child_group_id: group.id,
        active: true,
        settings: { isPrerequisite: true }
      }).save()
      const member = await createMember(group)
      const outsider = await factories.user({ email: addresses('prerequisite', 1)[0] }).save()
      await createInvitation(member.id, group.id, { emails: [outsider.get('email')] })
      const [invitation] = await invitesBy(member.id, group.id)

      await expect(joinGroup(group.id, outsider.id, [], null, invitation.get('token'), false, {}))
        .to.be.rejectedWith(/must be a member of group/)
      expect(await GroupMembership.forPair(outsider.id, group.id, { includeInactive: true }).fetch()).to.not.exist
    })
  })

  describe('expiring and resending', () => {
    let group, member, other, invitee, otherInvitation, inviteeInvitation

    before(async () => {
      group = await createGroup()
      member = await createMember(group)
      other = await createMember(group)
      invitee = await factories.user({ email: addresses('invitee', 1)[0] }).save()
      const create = (userId, email) =>
        Invitation.create({ userId, groupId: group.id, email })
      otherInvitation = await create(other.id, addresses('other', 1)[0])
      inviteeInvitation = await create(member.id, invitee.get('email'))
      mockify(Email, 'sendInvitation', () => Promise.resolve({}))
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('lets someone with Add Members cancel and resend any invitation', async () => {
      expect(await resendInvitation(member.id, otherInvitation.id)).to.deep.equal({ success: true })
      expect(await reinviteAll(member.id, group.id)).to.deep.equal({ success: true })
      expect(await expireInvitation(member.id, otherInvitation.id)).to.deep.equal({ success: true })
      expect((await Invitation.find(otherInvitation.id)).get('expired_by_id')).to.equal(member.id)
    })

    it('lets the invitee resend or cancel their invitation', async () => {
      expect(await resendInvitation(invitee.id, inviteeInvitation.id)).to.deep.equal({ success: true })
      expect(await expireInvitation(invitee.id, inviteeInvitation.id)).to.deep.equal({ success: true })
    })
  })
})
