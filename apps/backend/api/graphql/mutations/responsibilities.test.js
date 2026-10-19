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

describe('responsibilities mutations', () => {
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
