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

    it('reports missing privileges before anything about the role', async () => {
      await expect(addRoleToMember({ userId: user.id, roleId: memberRole.id, personId: user.id, groupId: group.id }))
        .to.be.rejectedWith("User doesn't have required privileges to add role to member")
    })
  })
})
