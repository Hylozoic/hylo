import { expect } from 'chai'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { addGroupRole } from './role'
import { addResponsibilityToRole, removeResponsibilityFromRole } from './responsibilities'

describe('responsibilities mutations', () => {
  let admin, otherAdmin, group, otherGroup, manageContent

  before(async () => {
    admin = factories.user()
    otherAdmin = factories.user()
    group = factories.group()
    otherGroup = factories.group()
    await Promise.join(group.save(), otherGroup.save(), admin.save(), otherAdmin.save())
    await admin.joinGroup(group, { assignAdministrator: true })
    await otherAdmin.joinGroup(otherGroup, { assignAdministrator: true })
    manageContent = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_CONTENT, type: 'system' }).fetch()
  })

  after(async () => setup.clearDb())

  describe('removeResponsibilityFromRole', () => {
    it('removes the responsibility from the role', async () => {
      const role = await addGroupRole({ groupId: group.id, name: 'Organizer', emoji: ':)', userId: admin.id })
      const roleResponsibility = await addResponsibilityToRole({ userId: admin.id, responsibilityId: manageContent.id, roleId: role.id, groupId: group.id })

      const result = await removeResponsibilityFromRole({ userId: admin.id, roleResponsibilityId: roleResponsibility.id, groupId: group.id })

      expect(result).to.deep.equal({ success: true })
      const remaining = await GroupRoleResponsibility.where({ group_role_id: role.id }).fetchAll()
      expect(remaining.length).to.equal(0)
    })

    it('does not remove a role responsibility that belongs to another group', async () => {
      const otherRole = await addGroupRole({ groupId: otherGroup.id, name: 'Other Organizer', emoji: ':(', userId: otherAdmin.id })
      const otherRoleResponsibility = await addResponsibilityToRole({ userId: otherAdmin.id, responsibilityId: manageContent.id, roleId: otherRole.id, groupId: otherGroup.id })

      await expect(removeResponsibilityFromRole({ userId: admin.id, roleResponsibilityId: otherRoleResponsibility.id, groupId: group.id }))
        .to.eventually.be.rejectedWith('Role responsibility not found in this group')

      const stillThere = await GroupRoleResponsibility.where({ id: otherRoleResponsibility.id }).fetch()
      expect(stillThere).to.not.equal(null)
    })
  })
})
