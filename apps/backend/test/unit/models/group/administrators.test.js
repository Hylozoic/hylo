/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import {
  countActiveAdministrators,
  countOrphanedGroups,
  findOrphanedGroups,
  isActiveAdministrator,
  isOrphanedGroup,
  searchActiveMembers,
  soleAdministratorGroups
} from '../../../../api/models/group/administrators'
import {
  assignOrphanedGroupAdministrator,
  mySoleAdministratorGroups,
  orphanedGroupMembers,
  orphanedGroups
} from '../../../../api/graphql/mutations/orphanedGroups'

async function assignRole (user, group, role) {
  return MemberGroupRole.forge({ user_id: user.id, group_id: group.id, group_role_id: role.id, active: true }).save()
}

describe('group/administrators', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  describe('countActiveAdministrators', () => {
    let group, first, second, keeperRole, keeper

    before(async () => {
      group = await factories.group().save()
      first = await factories.user().save()
      second = await factories.user().save()
      keeper = await factories.user().save()
      await first.joinGroup(group, { assignAdministrator: true })
      await second.joinGroup(group, { assignAdministrator: true })
      await keeper.joinGroup(group)
      keeperRole = await GroupRole.forge({ group_id: group.id, name: 'Keeper', emoji: '🗝️', type: GroupRole.TYPE_CUSTOM, active: true }).save()
      const administrationId = await Responsibility.systemId(Responsibility.constants.RESP_ADMINISTRATION)
      await GroupRoleResponsibility.forge({ group_role_id: keeperRole.id, responsibility_id: administrationId }).save()
      await assignRole(keeper, group, keeperRole)
    })

    it('counts people who hold Administration through any active role', async () => {
      expect(await countActiveAdministrators(group.id)).to.equal(3)
      expect(await isActiveAdministrator(keeper.id, group.id)).to.be.true
    })

    it('leaves out the excluded person, role, assignment or link', async () => {
      const administrator = await GroupRole.findSystemRole(group.id, 'Administrator')
      const link = await GroupRoleResponsibility.where({ group_role_id: keeperRole.id }).fetch()
      expect(await countActiveAdministrators(group.id, { excludeUserId: first.id })).to.equal(2)
      expect(await countActiveAdministrators(group.id, { excludeRoleId: administrator.id })).to.equal(1)
      expect(await countActiveAdministrators(group.id, { excludeAssignment: { userId: second.id, roleId: administrator.id } })).to.equal(2)
      expect(await countActiveAdministrators(group.id, { excludeRoleResponsibilityId: link.id })).to.equal(2)
    })

    it('skips deactivated accounts, inactive memberships and deactivated roles', async () => {
      await first.save({ active: false }, { patch: true })
      await bookshelf.knex('group_memberships').where({ user_id: second.id, group_id: group.id }).update({ active: false })
      await keeperRole.save({ active: false }, { patch: true })
      try {
        expect(await countActiveAdministrators(group.id)).to.equal(0)
        expect(await isActiveAdministrator(keeper.id, group.id)).to.be.false
      } finally {
        await first.save({ active: true }, { patch: true })
        await bookshelf.knex('group_memberships').where({ user_id: second.id, group_id: group.id }).update({ active: true })
        await keeperRole.save({ active: true }, { patch: true })
      }
    })
  })

  describe('groups without an Administrator', () => {
    let orphaned, inactiveAdmin, deactivatedRole, healthy, empty, moderator, host, member

    before(async () => {
      moderator = await factories.user({ name: 'Mona Moderator' }).save()
      host = await factories.user({ name: 'Hal Host' }).save()
      member = await factories.user({ name: 'Mel Member' }).save()

      // An Administrator who left, a Moderator and a Host remain
      orphaned = await factories.group().save()
      const leaver = await factories.user().save()
      await leaver.joinGroup(orphaned, { assignAdministrator: true })
      await moderator.joinGroup(orphaned)
      await host.joinGroup(orphaned)
      await member.joinGroup(orphaned)
      await assignRole(moderator, orphaned, await GroupRole.findSystemRole(orphaned.id, 'Moderator'))
      await assignRole(host, orphaned, await GroupRole.findSystemRole(orphaned.id, 'Host'))
      await leaver.leaveGroup(orphaned)

      // The only Administrator deactivated their account
      inactiveAdmin = await factories.group().save()
      const deactivated = await factories.user().save()
      await deactivated.joinGroup(inactiveAdmin, { assignAdministrator: true })
      await member.joinGroup(inactiveAdmin)
      await deactivated.save({ active: false }, { patch: true })

      // The Administrator role was switched off
      deactivatedRole = await factories.group().save()
      const holder = await factories.user().save()
      await holder.joinGroup(deactivatedRole, { assignAdministrator: true })
      await member.joinGroup(deactivatedRole)
      await (await GroupRole.findSystemRole(deactivatedRole.id, 'Administrator')).save({ active: false }, { patch: true })

      healthy = await factories.group().save()
      const administrator = await factories.user().save()
      await administrator.joinGroup(healthy, { assignAdministrator: true })
      await member.joinGroup(healthy)

      // Nobody left at all: nothing to look after
      empty = await factories.group().save()
      await GroupRole.setupSystemRoles(empty.id)
    })

    it('finds groups whose Administrators left, deactivated their account or lost the role', async () => {
      expect(await isOrphanedGroup(orphaned.id)).to.be.true
      expect(await isOrphanedGroup(inactiveAdmin.id)).to.be.true
      expect(await isOrphanedGroup(deactivatedRole.id)).to.be.true
      expect(await isOrphanedGroup(healthy.id)).to.be.false
      expect(await isOrphanedGroup(empty.id)).to.be.false
      expect(await countOrphanedGroups()).to.equal(3)
    })

    it('lists them with members, last activity and the Moderators and Hosts who could take over', async () => {
      const post = await factories.post({ user_id: member.id }).save()
      await post.groups().attach(orphaned.id)

      const { total, hasMore, items } = await findOrphanedGroups({ first: 2 })
      expect(total).to.equal(3)
      expect(hasMore).to.be.true
      expect(items).to.have.length(2)

      const all = (await findOrphanedGroups({ first: 10 })).items
      const listed = all.find(item => String(item.id) === String(orphaned.id))
      expect(listed.memberCount).to.equal(3)
      expect(listed.lastActivityAt).to.exist
      expect(listed.candidates.map(c => [c.name, c.roleName])).to.deep.equal([['Hal Host', 'Host'], ['Mona Moderator', 'Moderator']])
      expect(all.map(item => String(item.id))).to.not.include(String(healthy.id))
    })

    it('searches the active members of a group', async () => {
      const found = await searchActiveMembers(orphaned.id, { search: 'mo' })
      expect(found.map(person => person.name)).to.deep.equal(['Mona Moderator'])
      expect(found[0].roleName).to.equal('Moderator')
      expect((await searchActiveMembers(orphaned.id)).length).to.equal(3)
    })
  })

  describe('the staff tool', () => {
    let staff, someone, group, moderator, savedAdmins

    before(async () => {
      staff = await factories.user().save()
      someone = await factories.user().save()
      moderator = await factories.user().save()
      group = await factories.group().save()
      const leaver = await factories.user().save()
      await leaver.joinGroup(group, { assignAdministrator: true })
      await moderator.joinGroup(group)
      await leaver.leaveGroup(group)
      savedAdmins = process.env.HYLO_ADMINS
      process.env.HYLO_ADMINS = String(staff.id)
    })

    after(() => {
      if (savedAdmins === undefined) delete process.env.HYLO_ADMINS
      else process.env.HYLO_ADMINS = savedAdmins
    })

    it('is only for Hylo staff', async () => {
      const refusal = 'Unauthorized: Admin access required'
      await expect(orphanedGroups(someone.id, {})).to.be.rejectedWith(refusal)
      await expect(orphanedGroupMembers(someone.id, { groupId: group.id })).to.be.rejectedWith(refusal)
      await expect(assignOrphanedGroupAdministrator(someone.id, { groupId: group.id, personId: moderator.id })).to.be.rejectedWith(refusal)
      expect(await isOrphanedGroup(group.id)).to.be.true
    })

    it('lists the group and makes a member its Administrator', async () => {
      const { items } = await orphanedGroups(staff.id, { first: 50 })
      expect(items.map(item => String(item.id))).to.include(String(group.id))
      const members = await orphanedGroupMembers(staff.id, { groupId: group.id })
      expect(members.map(member => String(member.id))).to.deep.equal([String(moderator.id)])

      await expect(assignOrphanedGroupAdministrator(staff.id, { groupId: group.id, personId: someone.id }))
        .to.be.rejectedWith('Only an active member of this group can become its Administrator')

      expect(await assignOrphanedGroupAdministrator(staff.id, { groupId: group.id, personId: moderator.id })).to.deep.equal({ success: true })
      expect(await isOrphanedGroup(group.id)).to.be.false
      expect(await isActiveAdministrator(moderator.id, group.id)).to.be.true

      await expect(assignOrphanedGroupAdministrator(staff.id, { groupId: group.id, personId: moderator.id }))
        .to.be.rejectedWith('This group already has an Administrator')
    })
  })

  describe('soleAdministratorGroups', () => {
    it('lists the groups where someone is the only active Administrator and others remain', async () => {
      const person = await factories.user().save()
      const other = await factories.user().save()
      const alone = await factories.group({ name: 'Alone' }).save()
      const shared = await factories.group({ name: 'Shared' }).save()
      const solo = await factories.group({ name: 'Solo' }).save()
      await person.joinGroup(alone, { assignAdministrator: true })
      await other.joinGroup(alone)
      await person.joinGroup(shared, { assignAdministrator: true })
      await other.joinGroup(shared, { assignAdministrator: true })
      await person.joinGroup(solo, { assignAdministrator: true })

      const groups = await soleAdministratorGroups(person.id)
      expect(groups.map(group => group.name)).to.deep.equal(['Alone'])
      const mine = await mySoleAdministratorGroups(person.id)
      expect(mine.map(group => [String(group.id), group.name, group.slug])).to.deep.equal([[String(alone.id), 'Alone', alone.get('slug')]])
    })
  })

  describe('Responsibility.fetchForGroup', () => {
    it('leaves out people whose accounts are deactivated', async () => {
      const group = await factories.group().save()
      const active = await factories.user().save()
      const deactivated = await factories.user().save()
      await active.joinGroup(group, { assignAdministrator: true })
      await deactivated.joinGroup(group, { assignAdministrator: true })
      await deactivated.save({ active: false }, { patch: true })

      const rows = await Responsibility.fetchForGroup(group.id)
      const userIds = [...new Set(rows.map(row => String(row.user_id)))]
      expect(userIds).to.deep.equal([String(active.id)])
    })
  })
})
