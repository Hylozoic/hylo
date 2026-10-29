/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { addGroupRole } from './role'
import {
  addGroupResponsibility,
  addResponsibilityToRole,
  deleteGroupResponsibility,
  removeResponsibilityFromRole,
  updateGroupResponsibility
} from './responsibilities'

const MEMBER_ROLE_ERROR = 'The All Members role cannot be edited, assigned or used as a requirement'
const RESERVED_TITLE_ERROR = 'A built-in responsibility already has this title'

describe('responsibilities mutations', () => {
  let administrator, member, group, memberRole, customRole, addMembersId

  before(async () => {
    administrator = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await administrator.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
    memberRole = await GroupRole.findAllMembersRole(group.id)
    customRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '👋', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
  })

  after(async () => {
    await bookshelf.knex('group_roles_responsibilities')
      .whereIn('group_role_id', [memberRole.id, customRole.id])
      .del()
    await bookshelf.knex('responsibilities').where({ group_id: group.id }).del()
    await setup.clearDb()
  })

  describe('custom responsibility titles', () => {
    it('rejects the title of any built-in responsibility, ignoring case and spaces', async () => {
      for (const title of ['Add Members', ' add members ', 'ADMINISTRATION', 'remove Members']) {
        await expect(addGroupResponsibility({ groupId: group.id, title, userId: administrator.id }))
          .to.be.rejectedWith(RESERVED_TITLE_ERROR)
      }
      const created = await Responsibility.where({ group_id: group.id }).count()
      expect(Number(created)).to.equal(0)
    })

    it('still creates responsibilities with other titles', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Invite Members Weekly', userId: administrator.id })
      expect(responsibility.get('title')).to.equal('Invite Members Weekly')
    })

    it('rejects renaming a custom responsibility to a built-in title', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Welcome Newcomers', userId: administrator.id })
      await expect(updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'add members', userId: administrator.id }))
        .to.be.rejectedWith(RESERVED_TITLE_ERROR)
      await responsibility.refresh()
      expect(responsibility.get('title')).to.equal('Welcome Newcomers')
    })

    it('still allows editing the description or renaming to another title', async () => {
      const responsibility = await addGroupResponsibility({ groupId: group.id, title: 'Greet People', userId: administrator.id })
      const described = await updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'Greet People', description: 'Say hello', userId: administrator.id })
      expect(described.get('description')).to.equal('Say hello')
      const renamed = await updateGroupResponsibility({ groupId: group.id, responsibilityId: responsibility.id, title: 'Greet Everyone', userId: administrator.id })
      expect(renamed.get('title')).to.equal('Greet Everyone')
    })

    it('checks privileges before the title', async () => {
      await expect(addGroupResponsibility({ groupId: group.id, title: 'Invite Members', userId: member.id }))
        .to.be.rejectedWith("User doesn't have required privileges to create group responsibility")
    })
  })

  describe('the implicit All Members role', () => {
    it('cannot be given a responsibility', async () => {
      await expect(addResponsibilityToRole({ groupId: group.id, roleId: memberRole.id, responsibilityId: addMembersId, userId: administrator.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      const links = await GroupRoleResponsibility.where({ group_role_id: memberRole.id }).count()
      expect(Number(links)).to.equal(0)
    })

    it('cannot be given a responsibility through ids written in other forms Postgres reads as integers', async () => {
      for (const roleId of [`+${memberRole.id}`, `0x${Number(memberRole.id).toString(16)}`, `0_${memberRole.id}`]) {
        await expect(addResponsibilityToRole({ groupId: group.id, roleId, responsibilityId: addMembersId, userId: administrator.id }), roleId)
          .to.be.rejectedWith('Invalid role id')
      }
      const links = await GroupRoleResponsibility.where({ group_role_id: memberRole.id }).count()
      expect(Number(links)).to.equal(0)
    })

    it('cannot have a responsibility removed', async () => {
      const link = await GroupRoleResponsibility.forge({ group_role_id: memberRole.id, responsibility_id: addMembersId }).save()
      await expect(removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: link.id, userId: administrator.id }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      const stillLinked = await GroupRoleResponsibility.where({ id: link.id }).fetch()
      expect(stillLinked).to.exist
      await stillLinked.destroy()
    })

    it('leaves custom roles editable, including Add Members', async () => {
      const link = await addResponsibilityToRole({ groupId: group.id, roleId: customRole.id, responsibilityId: addMembersId, userId: administrator.id })
      expect(Number(link.get('group_role_id'))).to.equal(customRole.id)
      await removeResponsibilityFromRole({ groupId: group.id, roleResponsibilityId: link.id, userId: administrator.id })
      const remaining = await GroupRoleResponsibility.where({ id: link.id }).fetch()
      expect(remaining).to.be.null
    })
  })
})

describe('responsibilities mutations scoped to a group', () => {
  let admin, otherAdmin, group, otherGroup, manageContent, addMembers, systemRole

  before(async () => {
    admin = factories.user()
    otherAdmin = factories.user()
    group = factories.group()
    otherGroup = factories.group()
    await Promise.join(group.save(), otherGroup.save(), admin.save(), otherAdmin.save())
    await admin.joinGroup(group, { assignAdministrator: true })
    await otherAdmin.joinGroup(otherGroup, { assignAdministrator: true })
    manageContent = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_CONTENT, type: 'system' }).fetch()
    addMembers = await Responsibility.where({ title: Responsibility.constants.RESP_ADD_MEMBERS, type: 'system' }).fetch()
    systemRole = await GroupRole.where({ group_id: group.id, type: GroupRole.TYPE_SYSTEM, name: 'Host' }).fetch()
  })

  after(async () => {
    // clearDb keeps the responsibilities table, so remove the group-owned ones created here first
    const groupOwned = bookshelf.knex('responsibilities').select('id').whereNotNull('group_id')
    await bookshelf.knex('group_roles_responsibilities').whereIn('responsibility_id', groupOwned).del()
    await bookshelf.knex('responsibilities').whereNotNull('group_id').del()
    return setup.clearDb()
  })

  const newRole = (name, g = group, user = admin) => addGroupRole({ groupId: g.id, name, emoji: ':)', userId: user.id })

  describe('addResponsibilityToRole', () => {
    it('adds a system responsibility to a custom role', async () => {
      const role = await newRole('Adder')
      const roleResponsibility = await addResponsibilityToRole({ userId: admin.id, responsibilityId: manageContent.id, roleId: role.id, groupId: group.id })
      expect(Number(roleResponsibility.get('group_role_id'))).to.equal(role.id)
      expect(Number(roleResponsibility.get('responsibility_id'))).to.equal(manageContent.id)
    })

    it("adds the group's own custom responsibility to a custom role", async () => {
      const role = await newRole('Custom Adder')
      const custom = await addGroupResponsibility({ userId: admin.id, groupId: group.id, title: 'Greeting', description: 'Say hi' })
      const roleResponsibility = await addResponsibilityToRole({ userId: admin.id, responsibilityId: custom.id, roleId: role.id, groupId: group.id })
      expect(Number(roleResponsibility.get('responsibility_id'))).to.equal(custom.id)
    })

    it('is a no-op when the role already has the responsibility', async () => {
      const role = await newRole('Duplicate')
      const first = await addResponsibilityToRole({ userId: admin.id, responsibilityId: addMembers.id, roleId: role.id, groupId: group.id })
      const second = await addResponsibilityToRole({ userId: admin.id, responsibilityId: addMembers.id, roleId: role.id, groupId: group.id })
      expect(second.id).to.equal(first.id)
      const rows = await GroupRoleResponsibility.where({ group_role_id: role.id }).fetchAll()
      expect(rows.length).to.equal(1)
    })

    it('rejects a role from another group', async () => {
      const otherRole = await newRole('Elsewhere', otherGroup, otherAdmin)
      await expect(addResponsibilityToRole({ userId: admin.id, responsibilityId: manageContent.id, roleId: otherRole.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Role not found in this group')
      const rows = await GroupRoleResponsibility.where({ group_role_id: otherRole.id }).fetchAll()
      expect(rows.length).to.equal(0)
    })

    it('rejects a system (common) role', async () => {
      await expect(addResponsibilityToRole({ userId: admin.id, responsibilityId: manageContent.id, roleId: systemRole.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Common roles cannot have their responsibilities edited')
    })

    it("rejects another group's custom responsibility", async () => {
      const role = await newRole('Borrower')
      const othersResponsibility = await addGroupResponsibility({ userId: otherAdmin.id, groupId: otherGroup.id, title: 'Theirs', description: '' })
      await expect(addResponsibilityToRole({ userId: admin.id, responsibilityId: othersResponsibility.id, roleId: role.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Responsibility not available in this group')
    })
  })

  describe('removeResponsibilityFromRole', () => {
    it('removes the responsibility from the role', async () => {
      const role = await newRole('Organizer')
      const roleResponsibility = await addResponsibilityToRole({ userId: admin.id, responsibilityId: manageContent.id, roleId: role.id, groupId: group.id })

      const result = await removeResponsibilityFromRole({ userId: admin.id, roleResponsibilityId: roleResponsibility.id, groupId: group.id })

      expect(result).to.deep.equal({ success: true })
      const remaining = await GroupRoleResponsibility.where({ group_role_id: role.id }).fetchAll()
      expect(remaining.length).to.equal(0)
    })

    it('does not remove a role responsibility that belongs to another group', async () => {
      const otherRole = await newRole('Other Organizer', otherGroup, otherAdmin)
      const otherRoleResponsibility = await addResponsibilityToRole({ userId: otherAdmin.id, responsibilityId: manageContent.id, roleId: otherRole.id, groupId: otherGroup.id })

      await expect(removeResponsibilityFromRole({ userId: admin.id, roleResponsibilityId: otherRoleResponsibility.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Role responsibility not found in this group')

      const stillThere = await GroupRoleResponsibility.where({ id: otherRoleResponsibility.id }).fetch()
      expect(stillThere).to.not.equal(null)
    })

    it('does not remove a responsibility from a system (common) role', async () => {
      const systemLink = await GroupRoleResponsibility.where({ group_role_id: systemRole.id }).fetch()
      await expect(removeResponsibilityFromRole({ userId: admin.id, roleResponsibilityId: systemLink.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Common roles cannot have their responsibilities edited')
      const stillThere = await GroupRoleResponsibility.where({ id: systemLink.id }).fetch()
      expect(stillThere).to.not.equal(null)
    })
  })

  describe('updateGroupResponsibility / deleteGroupResponsibility', () => {
    it("updates and deletes the group's own responsibility", async () => {
      const custom = await addGroupResponsibility({ userId: admin.id, groupId: group.id, title: 'Mine', description: '' })
      const updated = await updateGroupResponsibility({ userId: admin.id, groupId: group.id, responsibilityId: custom.id, title: 'Mine renamed' })
      expect(updated.get('title')).to.equal('Mine renamed')
      await deleteGroupResponsibility({ userId: admin.id, groupId: group.id, responsibilityId: custom.id })
      expect(await Responsibility.where({ id: custom.id }).fetch()).to.equal(null)
    })

    it("rejects updating a system responsibility or another group's responsibility", async () => {
      const theirs = await addGroupResponsibility({ userId: otherAdmin.id, groupId: otherGroup.id, title: 'Not yours', description: '' })
      await expect(updateGroupResponsibility({ userId: admin.id, groupId: group.id, responsibilityId: theirs.id, title: 'Hijacked' }))
        .to.eventually.be.rejectedWith('Responsibility not found in this group')
      await expect(updateGroupResponsibility({ userId: admin.id, groupId: group.id, responsibilityId: manageContent.id, title: 'Renamed' }))
        .to.eventually.be.rejectedWith('Responsibility not found in this group')
      expect((await Responsibility.where({ id: theirs.id }).fetch()).get('title')).to.equal('Not yours')
      expect((await Responsibility.where({ id: manageContent.id }).fetch()).get('title')).to.equal(Responsibility.constants.RESP_MANAGE_CONTENT)
    })

    it("rejects deleting another group's responsibility with a clear error", async () => {
      const theirs = await addGroupResponsibility({ userId: otherAdmin.id, groupId: otherGroup.id, title: 'Keep me', description: '' })
      await expect(deleteGroupResponsibility({ userId: admin.id, groupId: group.id, responsibilityId: theirs.id }))
        .to.eventually.be.rejectedWith('Responsibility not found in this group')
    })
  })
})
