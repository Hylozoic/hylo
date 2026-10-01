/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  addGroupRole,
  addRoleToMember,
  removeRoleFromMember,
  updateGroupRole
} from './role'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'
const LAST_ADMINISTRATOR_ERROR = 'A group must keep at least one Administrator'

describe('roles mutations', () => {
  let user, user2, group

  const color = 'blue'
  const emoji = ':)'
  const name = 'Greeter'

  before(function () {
    user = factories.user()
    user2 = factories.user()
    group = factories.group()
    return Promise.join(group.save(), user.save(), user2.save())
      .then(() => user.joinGroup(group))
      .then(() => user2.joinGroup(group, { assignAdministrator: true }))
  })

  after(async () => setup.clearDb())

  it('creates a group role for a group', async () => {
    const groupRole = await addGroupRole({ groupId: group.id, color, name, emoji, userId: user2.id })
    expect(groupRole.get('color')).to.equal('blue')
  })

  it('throws an error if a non-mod create a group role', async () => {
    await expect(addGroupRole({ groupId: group.id, color, name, emoji, userId: user.id })).to.eventually.be.rejectedWith("User doesn't have required privileges to create group role")
  })

  it('adds a role to a group member', async () => {
    const groupRole = await addGroupRole({ groupId: group.id, color, name, emoji, userId: user2.id })
    const memberRole = await addRoleToMember({ userId: user2.id, roleId: groupRole.get('id'), personId: user.id, groupId: group.id })
    expect(parseInt(memberRole.get('group_role_id'))).to.equal(groupRole.get('id'))
  })

  it('removes a group role from a group member', async () => {
    const groupRole = await addGroupRole({ groupId: group.id, color, name, emoji, userId: user2.id })
    await addRoleToMember({ userId: user2.id, roleId: groupRole.get('id'), personId: user.id, groupId: group.id })
    const deleted = await removeRoleFromMember({ userId: user2.id, roleId: groupRole.get('id'), personId: user.id, groupId: group.id })
    expect(deleted.get('id')).to.equal(undefined)
  })

  it('updates a group role', async () => {
    const groupRole = await addGroupRole({ groupId: group.id, color, name, emoji, userId: user2.id })
    const updatedGroupRole = await updateGroupRole({ groupId: group.id, color: 'green', name, emoji, userId: user2.id, groupRoleId: groupRole.get('id') })
    expect(updatedGroupRole.get('color')).to.equal('green')
  })

  describe('keeping an Administrator', () => {
    let soloGroup, administrator, member, administratorRole

    beforeEach(async () => {
      administrator = await factories.user().save()
      member = await factories.user().save()
      soloGroup = await factories.group().save()
      await administrator.joinGroup(soloGroup, { assignAdministrator: true })
      await member.joinGroup(soloGroup)
      administratorRole = await GroupRole.findSystemRole(soloGroup.id, 'Administrator')
    })

    it('refuses to take the Administrator role from the only Administrator', async () => {
      await expect(removeRoleFromMember({ userId: administrator.id, roleId: administratorRole.id, personId: administrator.id, groupId: soloGroup.id }))
        .to.be.rejectedWith(LAST_ADMINISTRATOR_ERROR)
      expect(await GroupMembership.hasResponsibility(administrator.id, soloGroup.id, Responsibility.constants.RESP_ADMINISTRATION)).to.be.true
    })

    it('takes the role away when another Administrator remains', async () => {
      await addRoleToMember({ userId: administrator.id, roleId: administratorRole.id, personId: member.id, groupId: soloGroup.id })
      await removeRoleFromMember({ userId: member.id, roleId: administratorRole.id, personId: administrator.id, groupId: soloGroup.id })
      expect(await GroupMembership.hasResponsibility(administrator.id, soloGroup.id, Responsibility.constants.RESP_ADMINISTRATION)).to.be.false
    })

    it('counts only active accounts as the other Administrator', async () => {
      await addRoleToMember({ userId: administrator.id, roleId: administratorRole.id, personId: member.id, groupId: soloGroup.id })
      await member.save({ active: false }, { patch: true })
      await expect(removeRoleFromMember({ userId: administrator.id, roleId: administratorRole.id, personId: administrator.id, groupId: soloGroup.id }))
        .to.be.rejectedWith(LAST_ADMINISTRATOR_ERROR)
    })

    it('refuses to deactivate the only role that gives anyone Administration', async () => {
      const keeper = await addGroupRole({ groupId: soloGroup.id, color, name: 'Keeper', emoji, userId: administrator.id })
      const administrationId = await Responsibility.systemId(Responsibility.constants.RESP_ADMINISTRATION)
      await GroupRoleResponsibility.forge({ group_role_id: keeper.id, responsibility_id: administrationId }).save()
      await addRoleToMember({ userId: administrator.id, roleId: keeper.id, personId: member.id, groupId: soloGroup.id })
      await bookshelf.knex('group_memberships_group_roles').where({ user_id: administrator.id, group_id: soloGroup.id }).del()

      await expect(updateGroupRole({ groupId: soloGroup.id, active: false, userId: member.id, groupRoleId: keeper.id }))
        .to.be.rejectedWith(LAST_ADMINISTRATOR_ERROR)
      await keeper.refresh()
      expect(keeper.get('active')).to.equal(true)

      await addRoleToMember({ userId: member.id, roleId: administratorRole.id, personId: administrator.id, groupId: soloGroup.id })
      const deactivated = await updateGroupRole({ groupId: soloGroup.id, active: false, userId: member.id, groupRoleId: keeper.id })
      expect(deactivated.get('active')).to.equal(false)
    })

    it('still lets other changes to a role through', async () => {
      const renamed = await updateGroupRole({ groupId: soloGroup.id, name: 'Administrator', description: 'Runs the group', userId: administrator.id, groupRoleId: administratorRole.id })
      expect(renamed.get('description')).to.equal('Runs the group')
    })
  })

  describe('deactivating a role', () => {
    it("expires the pending member invitations of people who could only invite through it, and keeps others'", async () => {
      const administrator = await factories.user().save()
      const greeter = await factories.user().save()
      const inviteGroup = await factories.group().save()
      await administrator.joinGroup(inviteGroup, { assignAdministrator: true })
      await greeter.joinGroup(inviteGroup)
      const greeterRole = await addGroupRole({ groupId: inviteGroup.id, color, name: 'Greeter', emoji, userId: administrator.id })
      await GroupRole.setInvitePolicy(inviteGroup.id, { mode: 'roles', roleIds: [greeterRole.id] })
      await MemberGroupRole.forge({ user_id: greeter.id, group_id: inviteGroup.id, group_role_id: greeterRole.id, active: true }).save()
      const limited = Invitation.InviterAccess.LIMITED
      const fromGreeter = await Invitation.create({ userId: greeter.id, groupId: inviteGroup.id, email: `greeter-${Date.now()}@example.com`, inviterAccess: limited })
      const fromAdministrator = await Invitation.create({ userId: administrator.id, groupId: inviteGroup.id, email: `admin-${Date.now()}@example.com` })

      await updateGroupRole({ groupId: inviteGroup.id, active: false, userId: administrator.id, groupRoleId: greeterRole.id })

      await fromGreeter.refresh()
      await fromAdministrator.refresh()
      expect(fromGreeter.isExpired()).to.be.true
      expect(fromAdministrator.isExpired()).to.be.false
    })
  })

  describe('the implicit Member role', () => {
    let memberRole

    before(async () => {
      memberRole = await GroupRole.findMemberRole(group.id)
    })

    it('cannot be renamed or deactivated', async () => {
      await expect(updateGroupRole({ groupId: group.id, name: 'Everyone', emoji, userId: user2.id, groupRoleId: memberRole.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      await expect(updateGroupRole({ groupId: group.id, active: false, userId: user2.id, groupRoleId: memberRole.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)

      await memberRole.refresh()
      expect(memberRole.get('name')).to.equal('Member')
      expect(memberRole.get('active')).to.equal(true)
    })

    it('cannot be assigned to a member', async () => {
      await expect(addRoleToMember({ userId: user2.id, roleId: memberRole.id, personId: user.id, groupId: group.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)

      const assignments = await MemberGroupRole.where({ group_role_id: memberRole.id }).count()
      expect(Number(assignments)).to.equal(0)
    })

    it('cannot be removed from a member, even by that member', async () => {
      await expect(removeRoleFromMember({ userId: user.id, roleId: memberRole.id, personId: user.id, groupId: group.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      await expect(removeRoleFromMember({ userId: user2.id, roleId: memberRole.id, personId: user.id, groupId: group.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
    })

    it('cannot be reached through ids written in other forms Postgres reads as integers', async () => {
      const forms = [`+${memberRole.id}`, `0x${Number(memberRole.id).toString(16)}`, `0_${memberRole.id}`, `${memberRole.id}x`]
      for (const roleId of forms) {
        await expect(updateGroupRole({ groupId: group.id, name: 'Renamed', active: false, userId: user2.id, groupRoleId: roleId }), roleId)
          .to.be.rejected
        await expect(addRoleToMember({ userId: user2.id, roleId, personId: user.id, groupId: group.id }), roleId)
          .to.be.rejected
        await expect(removeRoleFromMember({ userId: user2.id, roleId, personId: user.id, groupId: group.id }), roleId)
          .to.be.rejected
      }

      await memberRole.refresh()
      expect(memberRole.get('name')).to.equal('Member')
      expect(memberRole.get('active')).to.equal(true)
      const assignments = await MemberGroupRole.where({ group_role_id: memberRole.id }).count()
      expect(Number(assignments)).to.equal(0)
    })

    it('reports missing privileges before anything about the role', async () => {
      await expect(addRoleToMember({ userId: user.id, roleId: memberRole.id, personId: user.id, groupId: group.id }))
        .to.be.rejectedWith("User doesn't have required privileges to add role to member")
    })
  })
})
