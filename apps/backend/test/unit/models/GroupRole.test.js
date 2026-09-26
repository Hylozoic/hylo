/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'

async function memberRoleRows (groupId) {
  return bookshelf.knex('groups_roles').where({ group_id: groupId, type: GroupRole.TYPE_MEMBER })
}

async function linkedResponsibilityIds (roleId) {
  const rows = await bookshelf.knex('group_roles_responsibilities')
    .where({ group_role_id: roleId })
    .orderBy('responsibility_id')
  return rows.map(row => Number(row.responsibility_id))
}

describe('GroupRole', () => {
  let user, group, space

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
  })

  after(() => setup.clearDb())

  describe('the implicit Member role', () => {
    it('is created by setupSystemRoles with no responsibilities', async () => {
      await GroupRole.setupSystemRoles(group.id)

      const rows = await memberRoleRows(group.id)
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].name).to.equal('Member')
      expect(rows[0].active).to.equal(true)
      expect(rows[0].scopes).to.equal(null)
      expect(await linkedResponsibilityIds(rows[0].id)).to.deep.equal([])
    })

    it('is not duplicated, linked or unlinked when setupSystemRoles runs again', async () => {
      const memberRole = await GroupRole.findMemberRole(group.id)
      const inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS)
      await GroupRoleResponsibility.forge({ group_role_id: memberRole.id, responsibility_id: inviteMembersId }).save()

      await GroupRole.setupSystemRoles(group.id)

      const rows = await memberRoleRows(group.id)
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].id).to.equal(memberRole.id)
      expect(await linkedResponsibilityIds(memberRole.id)).to.deep.equal([inviteMembersId])

      await bookshelf.knex('group_roles_responsibilities').where({ group_role_id: memberRole.id }).del()
    })

    it('is created by Group.create', async () => {
      const created = await Group.create(user.id, { name: 'Member Role Group', slug: `member-role-${Date.now()}` })
      const memberRole = await GroupRole.findMemberRole(created.id)
      expect(memberRole).to.exist
      expect(memberRole.get('type')).to.equal(GroupRole.TYPE_MEMBER)
      expect(await linkedResponsibilityIds(memberRole.id)).to.deep.equal([])
    })

    it('is never created for a space', async () => {
      await GroupRole.setupSystemRoles(space.id)
      expect(await GroupRole.ensureMemberRole(space.id)).to.be.null
      expect(await GroupRole.findMemberRole(space.id)).to.be.null
      expect(await memberRoleRows(space.id)).to.have.lengthOf(0)

      const orphanSpace = await factories.group({ type: 'space' }).save()
      expect(await GroupRole.ensureMemberRole(orphanSpace.id)).to.be.null
      expect(await memberRoleRows(orphanSpace.id)).to.have.lengthOf(0)
    })

    it('ensureMemberRole returns null for a missing group', async () => {
      expect(await GroupRole.ensureMemberRole(null)).to.be.null
      expect(await GroupRole.ensureMemberRole(99999999)).to.be.null
    })

    it('ensureMemberRole creates the row lazily and then returns the same row', async () => {
      const olderGroup = await factories.group().save()
      expect(await GroupRole.findMemberRole(olderGroup.id)).to.be.null

      const first = await GroupRole.ensureMemberRole(olderGroup.id)
      const second = await GroupRole.ensureMemberRole(olderGroup.id)
      expect(first.id).to.equal(second.id)
      expect(await memberRoleRows(olderGroup.id)).to.have.lengthOf(1)
    })

    it('survives concurrent creation, inside and outside transactions', async () => {
      const racedGroup = await factories.group().save()
      await GroupRole.setupSystemRoles(racedGroup.id)
      await bookshelf.knex('groups_roles').where({ group_id: racedGroup.id, type: GroupRole.TYPE_MEMBER }).del()

      await Promise.all([
        GroupRole.setupSystemRoles(racedGroup.id),
        GroupRole.ensureMemberRole(racedGroup.id),
        bookshelf.transaction(transacting => GroupRole.ensureMemberRole(racedGroup.id, { transacting })),
        bookshelf.transaction(transacting => GroupRole.setupSystemRoles(racedGroup.id, { transacting })),
        GroupRole.ensureMemberRole(racedGroup.id)
      ])

      expect(await memberRoleRows(racedGroup.id)).to.have.lengthOf(1)
    })

    it('is left unlinked by an invitation that assigns Administrator', async () => {
      const invitedGroup = await factories.group().save()
      await Invitation.create({
        userId: user.id,
        groupId: invitedGroup.id,
        email: `member-role-${Date.now()}@example.com`,
        assignAdministrator: true
      })

      const memberRole = await GroupRole.findMemberRole(invitedGroup.id)
      expect(memberRole).to.exist
      expect(await linkedResponsibilityIds(memberRole.id)).to.deep.equal([])
    })

    it('cannot be given scopes', async () => {
      const memberRole = await GroupRole.findMemberRole(group.id)
      await expect(memberRole.setScopes(['group:1'])).to.be.rejectedWith('The Member role cannot grant scopes')
      await memberRole.refresh()
      expect(memberRole.get('scopes')).to.equal(null)
    })
  })

  describe('assertAssignableRoleIds', () => {
    let memberRole, administrator, customRole

    before(async () => {
      memberRole = await GroupRole.findMemberRole(group.id)
      administrator = await GroupRole.findSystemRole(group.id, 'Administrator')
      customRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '👋', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    })

    it('accepts system and custom roles', async () => {
      await GroupRole.assertAssignableRoleIds([administrator.id, String(customRole.id), { id: customRole.id }])
    })

    it('rejects the Member role as a number, a string or an { id } object', async () => {
      await expect(GroupRole.assertAssignableRoleIds(memberRole.id)).to.be.rejectedWith(MEMBER_ROLE_ERROR)
      await expect(GroupRole.assertAssignableRoleIds([administrator.id, String(memberRole.id)])).to.be.rejectedWith(MEMBER_ROLE_ERROR)
      await expect(GroupRole.assertAssignableRoleIds([{ id: String(memberRole.id) }])).to.be.rejectedWith(MEMBER_ROLE_ERROR)
    })

    it('ignores empty and malformed ids', async () => {
      await GroupRole.assertAssignableRoleIds(null)
      await GroupRole.assertAssignableRoleIds([])
      await GroupRole.assertAssignableRoleIds([null, undefined, '', 'abc', '1.5', '-3', '99999999999999999999', {}])
    })

    it('uses a transaction when given one', async () => {
      await bookshelf.transaction(async transacting => {
        const role = await GroupRole.forge({ group_id: group.id, name: 'Draft Role', emoji: '📝', type: GroupRole.TYPE_CUSTOM, active: true }).save(null, { transacting })
        await GroupRole.assertAssignableRoleIds([role.id], { transacting })
        await expect(GroupRole.assertAssignableRoleIds([role.id, memberRole.id], { transacting })).to.be.rejectedWith(MEMBER_ROLE_ERROR)
      })
    })
  })
})
