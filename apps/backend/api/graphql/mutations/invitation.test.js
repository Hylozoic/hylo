/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify, withFeatureFlag } from '../../../test/setup/helpers'
import { createInvitation, createMemberInviteLink, expireInvitation, reinviteAll, resendInvitation, resetMemberInviteLink, useInvitation } from './invitation'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'
const NO_PERMISSION = "You don't have permission to create an invitation for this group"
const NO_MODIFY_PERMISSION = "You don't have permission to modify this invitation"

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
    const memberRole = await GroupRole.findMemberRole(group.id)
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
  const sent = emails => emails.map(email => ({ email, status: 'sent' }))
  const settle = calls => Promise.all(calls.map(call => call.then(() => 'sent', err => err.message)))

  const createGroup = async (mode = 'everyone') => {
    const group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await GroupRole.setInvitePolicy(group.id, { mode })
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

      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      const result = await createInvitation(member.id, group.id, { emails: [email] })
      expect(result).to.deep.equal({ invitations: sent([email]) })

      const invitations = await invitesBy(member.id, group.id)
      expect(invitations.map(i => [i.get('email'), i.get('inviter_access')])).to.deep.equal([[email, 'limited']])
      expect(invitations[0].get('message')).to.include(group.get('name'))
      expect(queuedInvitationIds()).to.deep.equal([invitations[0].id])
    })

    it('does not let members invite while member invitations are switched off', async () => {
      const group = await createGroup('everyone')
      const member = await createMember(group)
      const [email] = addresses('switched-off', 1)

      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        await expect(createInvitation(member.id, group.id, { emails: [email] })).to.be.rejectedWith(NO_PERMISSION)
        const result = await createInvitation(admin.id, group.id, { emails: addresses('switched-off-admin', 1) })
        expect(result.invitations[0].id).to.exist
      })

      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(0)
      expect(await ledgerTotal({ user_id: member.id })).to.equal(0)
    })

    it('rejects roles, people by id and spaces', async () => {
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
      await expect(createInvitation(member.id, group.id, { emails, userIds: [other.id] }))
        .to.be.rejectedWith('You can only invite people by email address')
      await expect(createInvitation(member.id, space.id, { emails })).to.be.rejectedWith(NO_PERMISSION)

      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(0)
      expect(await invitesBy(member.id, space.id)).to.have.lengthOf(0)
      expect(await ledgerTotal({ user_id: member.id })).to.equal(0)
      expect(queuedInvitationIds()).to.deep.equal([])
    })

    it('lets members invite people who share a group with them only while the people picker is switched on', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      const neighbourhood = await factories.group().save()
      const neighbour = await factories.user().save()
      await member.joinGroup(neighbourhood)
      await neighbour.joinGroup(neighbourhood)

      await expect(createInvitation(member.id, group.id, { userIds: [neighbour.id] }))
        .to.be.rejectedWith('You can only invite people by email address')
      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        await withFeatureFlag('MEMBER_INVITE_PICKER', 'on', async () => {
          await expect(createInvitation(member.id, group.id, { userIds: [neighbour.id] })).to.be.rejectedWith(NO_PERMISSION)
        })
      })
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(0)

      const result = await withFeatureFlag('MEMBER_INVITE_PICKER', 'on', () =>
        createInvitation(member.id, group.id, { userIds: [neighbour.id] }))
      expect(result).to.deep.equal({ invitations: [{ userId: String(neighbour.id), status: 'sent' }] })
      const invitations = await invitesBy(member.id, group.id)
      expect(invitations.map(i => [i.get('email'), i.get('inviter_access')])).to.deep.equal([[neighbour.get('email').toLowerCase(), 'limited']])
      expect(queuedInvitationIds()).to.deep.equal([])
    })

    it('takes at most 10 different valid addresses at a time', async () => {
      const group = await createGroup()
      const member = await createMember(group)

      await expect(createInvitation(member.id, group.id, { emails: addresses('eleven', 11) }))
        .to.be.rejectedWith('You can invite up to 10 email addresses at a time')
      expect(await ledgerTotal({ user_id: member.id })).to.equal(0)

      const ten = addresses('ten', 10)
      const typed = [...ten, ` ${ten[0].toUpperCase()} `, 'not-an-email', '']
      const result = await createInvitation(member.id, group.id, { emails: typed })
      expect(result.invitations).to.deep.equal([...sent(ten), { email: 'not-an-email', error: 'invalid' }])
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
      expect(result.invitations).to.deep.equal(sent(typed.map(email => email.toLowerCase())))

      const invitations = await invitesBy(member.id, group.id)
      expect(invitations.map(i => i.get('email'))).to.deep.equal([invitedByMember, fresh])
      expect(queuedInvitationIds()).to.deep.equal([invitations[1].id])
      expect(await ledgerTotal({ user_id: member.id, group_id: group.id })).to.equal(6)
      expect(await InvitationSend.remainingAllowance({ userId: member.id, groupId: group.id })).to.equal(19)
    })

    it('allows 25 addresses per sender and 100 per group in any 24 hours', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
      await bookshelf.knex('invitation_sends').insert({ user_id: member.id, group_id: group.id, recipients: 25, created_at: dayAgo })

      await createInvitation(member.id, group.id, { emails: addresses('sender', 10) })
      await createInvitation(member.id, group.id, { emails: addresses('sender', 10) })
      await expect(createInvitation(member.id, group.id, { emails: addresses('sender', 10) })).to.be.rejectedWith('invite-limit')
      await createInvitation(member.id, group.id, { emails: addresses('sender', 5) })
      await expect(createInvitation(member.id, group.id, { emails: addresses('sender', 1) })).to.be.rejectedWith('invite-limit')
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(25)
      expect(await InvitationSend.remainingAllowance({ userId: member.id, groupId: group.id })).to.equal(0)

      const busyGroup = await createGroup()
      const sender = await createMember(busyGroup)
      await bookshelf.knex('invitation_sends').insert({ user_id: admin.id, group_id: busyGroup.id, recipients: 95 })
      await expect(createInvitation(sender.id, busyGroup.id, { emails: addresses('group', 10) })).to.be.rejectedWith('invite-limit')
      await createInvitation(sender.id, busyGroup.id, { emails: addresses('group', 5) })
      expect(await invitesBy(sender.id, busyGroup.id)).to.have.lengthOf(5)
      expect(await ledgerTotal({ group_id: busyGroup.id })).to.equal(100)
      expect(await InvitationSend.remainingAllowance({ userId: sender.id, groupId: busyGroup.id })).to.equal(0)
    })

    it('never goes over either limit when sends run at the same time', async () => {
      const group = await createGroup()
      const member = await createMember(group)
      const outcomes = await settle(Array.from({ length: 5 }, () =>
        createInvitation(member.id, group.id, { emails: addresses('parallel', 10) })))
      expect(outcomes.sort()).to.deep.equal(['invite-limit', 'invite-limit', 'invite-limit', 'sent', 'sent'])
      expect(await ledgerTotal({ user_id: member.id })).to.equal(20)
      expect(await invitesBy(member.id, group.id)).to.have.lengthOf(20)

      const busyGroup = await createGroup()
      await bookshelf.knex('invitation_sends').insert({ user_id: admin.id, group_id: busyGroup.id, recipients: 80 })
      const senders = await Promise.all(Array.from({ length: 5 }, () => createMember(busyGroup)))
      const groupOutcomes = await settle(senders.map(sender =>
        createInvitation(sender.id, busyGroup.id, { emails: addresses('parallel-group', 10) })))
      expect(groupOutcomes.sort()).to.deep.equal(['invite-limit', 'invite-limit', 'invite-limit', 'sent', 'sent'])
      expect(await ledgerTotal({ group_id: busyGroup.id })).to.equal(100)
      const created = await Invitation.where({ group_id: busyGroup.id, inviter_access: 'limited' }).count()
      expect(Number(created)).to.equal(20)
    })

    it('leaves invitations from Add Members holders as they were', async () => {
      const group = await createGroup()
      const [email] = addresses('steward', 1)
      const result = await createInvitation(admin.id, group.id, { emails: [email] })
      const [invitation] = result.invitations
      expect(invitation.status).to.be.undefined
      expect(invitation.id).to.exist
      expect((await Invitation.find(invitation.id)).get('inviter_access')).to.equal('full')
      expect(await ledgerTotal({ user_id: admin.id, group_id: group.id })).to.equal(0)
    })
  })

  describe('personal invite links', () => {
    it('gives members with limited invite access one link, which Reset replaces', async () => {
      const group = await createGroup()
      const member = await createMember(group)

      const link = await createMemberInviteLink(member.id, group.id)
      expect(link.path).to.match(new RegExp(`^/groups/${group.get('slug')}/join/[A-Za-z0-9]{16}$`))
      expect(await createMemberInviteLink(member.id, group.id)).to.deep.equal(link)

      const reset = await resetMemberInviteLink(member.id, group.id)
      expect(reset.path).to.not.equal(link.path)
      expect(await createMemberInviteLink(member.id, group.id)).to.deep.equal(reset)
      expect(link.path).to.not.include(group.get('access_code'))
    })

    it('gives no link to stewards, to members who cannot invite, or while member invitations are off', async () => {
      const group = await createGroup('stewards')
      const member = await createMember(group)
      const noLink = "You don't have permission to create an invite link for this group"
      await expect(createMemberInviteLink(member.id, group.id)).to.be.rejectedWith(noLink)
      await expect(createMemberInviteLink(admin.id, group.id)).to.be.rejectedWith(noLink)
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        await expect(createMemberInviteLink(member.id, group.id)).to.be.rejectedWith(noLink)
        await expect(resetMemberInviteLink(member.id, group.id)).to.be.rejectedWith(noLink)
      })
      expect(await MemberInviteLink.findActive({ groupId: group.id, userId: member.id })).to.not.exist
    })
  })

  describe('useInvitation', () => {
    it('does not skip the prerequisite groups of an Open group', async () => {
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

      expect(await useInvitation(outsider.id, invitation.get('token')))
        .to.deep.equal({ requiresApproval: true, groupSlug: group.get('slug') })
      expect(await GroupMembership.forPair(outsider.id, group.id, { includeInactive: true }).fetch()).to.not.exist
    })
  })

  describe('expiring and resending', () => {
    let group, member, other, invitee, ownInvitation, otherInvitation, stewardInvitation, inviteeInvitation

    before(async () => {
      group = await createGroup()
      member = await createMember(group)
      other = await createMember(group)
      invitee = await factories.user({ email: addresses('invitee', 1)[0] }).save()
      const create = (userId, email, inviterAccess) =>
        Invitation.create({ userId, groupId: group.id, email, inviterAccess })
      ownInvitation = await create(member.id, addresses('own', 1)[0], 'limited')
      otherInvitation = await create(other.id, addresses('other', 1)[0], 'limited')
      stewardInvitation = await create(admin.id, addresses('steward', 1)[0], 'full')
      inviteeInvitation = await create(member.id, invitee.get('email'), 'limited')
      mockify(Email, 'sendInvitation', () => Promise.resolve({}))
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('lets a member cancel only the invitations they sent', async () => {
      await expect(expireInvitation(member.id, otherInvitation.id)).to.be.rejectedWith(NO_MODIFY_PERMISSION)
      await expect(expireInvitation(member.id, stewardInvitation.id)).to.be.rejectedWith(NO_MODIFY_PERMISSION)
      expect(await expireInvitation(member.id, ownInvitation.id)).to.deep.equal({ success: true })
      expect((await Invitation.find(ownInvitation.id)).get('expired_by_id')).to.equal(member.id)
    })

    it('does not let a member resend their invitations or reinvite everyone', async () => {
      await expect(resendInvitation(member.id, otherInvitation.id)).to.be.rejectedWith(NO_MODIFY_PERMISSION)
      await expect(reinviteAll(member.id, group.id)).to.be.rejectedWith(NO_MODIFY_PERMISSION)
      expect((await Invitation.find(otherInvitation.id)).get('sent_count')).to.equal(0)
    })

    it('still lets the invitee resend or cancel their invitation, and stewards cancel any', async () => {
      expect(await resendInvitation(invitee.id, inviteeInvitation.id)).to.deep.equal({ success: true })
      expect(await expireInvitation(invitee.id, inviteeInvitation.id)).to.deep.equal({ success: true })
      expect(await expireInvitation(admin.id, otherInvitation.id)).to.deep.equal({ success: true })
      expect((await Invitation.find(otherInvitation.id)).get('expired_by_id')).to.equal(admin.id)
    })
  })
})
