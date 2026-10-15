/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

const ALL_MEMBERS_ROLE_ERROR = 'The All Members role cannot be edited, assigned or used as a requirement'

async function allMembersRows (groupId) {
  return bookshelf.knex('groups_roles').where({ group_id: groupId, type: GroupRole.TYPE_ALL_MEMBERS })
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

  describe('the implicit All Members role', () => {
    it('is created by setupSystemRoles with no responsibilities', async () => {
      await GroupRole.setupSystemRoles(group.id)

      const rows = await allMembersRows(group.id)
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].name).to.equal('All Members')
      expect(rows[0].active).to.equal(true)
      expect(await linkedResponsibilityIds(rows[0].id)).to.deep.equal([])
    })

    it('is not duplicated when setupSystemRoles runs again', async () => {
      const allMembers = await GroupRole.findAllMembersRole(group.id)
      const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
      await GroupRoleResponsibility.forge({ group_role_id: allMembers.id, responsibility_id: addMembersId }).save()

      await GroupRole.setupSystemRoles(group.id)

      const rows = await allMembersRows(group.id)
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].id).to.equal(allMembers.id)
      expect(await linkedResponsibilityIds(allMembers.id)).to.deep.equal([addMembersId])

      await bookshelf.knex('group_roles_responsibilities').where({ group_role_id: allMembers.id }).del()
    })

    it('is created by Group.create', async () => {
      const created = await Group.create(user.id, { name: 'All Members Group', slug: `all-members-${Date.now()}` })
      const allMembers = await GroupRole.findAllMembersRole(created.id)
      expect(allMembers).to.exist
      expect(allMembers.get('type')).to.equal(GroupRole.TYPE_ALL_MEMBERS)
      expect(await GroupRole.getInvitePolicy(created.id)).to.equal('stewards')
    })

    it('is never created for a space', async () => {
      await GroupRole.setupSystemRoles(space.id)
      expect(await GroupRole.ensureAllMembersRole(space.id)).to.be.null
      expect(await GroupRole.findAllMembersRole(space.id)).to.be.null
      expect(await allMembersRows(space.id)).to.have.lengthOf(0)
    })

    it('ensureAllMembersRole creates the row lazily and then returns the same row', async () => {
      const olderGroup = await factories.group().save()
      await bookshelf.knex('groups_roles').where({ group_id: olderGroup.id, type: GroupRole.TYPE_ALL_MEMBERS }).del()
      expect(await GroupRole.findAllMembersRole(olderGroup.id)).to.be.null

      const first = await GroupRole.ensureAllMembersRole(olderGroup.id)
      const second = await GroupRole.ensureAllMembersRole(olderGroup.id)
      expect(first.id).to.equal(second.id)
      expect(await allMembersRows(olderGroup.id)).to.have.lengthOf(1)
    })

    it('cannot be given scopes', async () => {
      const allMembers = await GroupRole.findAllMembersRole(group.id)
      await expect(allMembers.setScopes(['group:1'])).to.be.rejectedWith('The All Members role cannot grant scopes')
      await allMembers.refresh()
      expect(allMembers.get('scopes')).to.equal(null)
    })
  })

  describe('assertAssignableRoleIds', () => {
    let allMembers, administrator, customRole

    before(async () => {
      allMembers = await GroupRole.findAllMembersRole(group.id)
      administrator = await GroupRole.findSystemRole(group.id, 'Administrator')
      customRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '👋', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    })

    it('accepts system and custom roles', async () => {
      await GroupRole.assertAssignableRoleIds([administrator.id, String(customRole.id), { id: customRole.id }])
    })

    it('rejects the All Members role', async () => {
      await expect(GroupRole.assertAssignableRoleIds(allMembers.id)).to.be.rejectedWith(ALL_MEMBERS_ROLE_ERROR)
      await expect(GroupRole.assertAssignableRoleIds([administrator.id, String(allMembers.id)])).to.be.rejectedWith(ALL_MEMBERS_ROLE_ERROR)
    })

    it('skips missing ids', async () => {
      await GroupRole.assertAssignableRoleIds(null)
      await GroupRole.assertAssignableRoleIds([])
      await GroupRole.assertAssignableRoleIds([null, '', administrator.id])
    })
  })

  describe('parseRoleId', () => {
    it('reads numbers, digit strings and { id } objects', () => {
      expect(GroupRole.parseRoleId(12)).to.equal(12)
      expect(GroupRole.parseRoleId('12')).to.equal(12)
      expect(GroupRole.parseRoleId({ id: '12' })).to.equal(12)
    })

    it('returns null for anything else', () => {
      for (const value of [null, undefined, '', '+12', 'abc', 1.5, true]) {
        expect(GroupRole.parseRoleId(value), JSON.stringify(value)).to.equal(null)
      }
    })
  })

  describe('invite policy', () => {
    let policyGroup, otherGroup, addMembersId, allMembers, greeter

    async function addMembersLinks (groupId) {
      const rows = await bookshelf.knex('group_roles_responsibilities as grr')
        .join('groups_roles as gr', 'gr.id', 'grr.group_role_id')
        .where({ 'gr.group_id': groupId, 'grr.responsibility_id': addMembersId })
        .orderBy('gr.id')
        .select('gr.id')
      return rows.map(row => Number(row.id))
    }

    before(async () => {
      policyGroup = await factories.group().save()
      otherGroup = await factories.group().save()
      await GroupRole.setupSystemRoles(policyGroup.id)
      await GroupRole.setupSystemRoles(otherGroup.id)
      addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
      allMembers = await GroupRole.findAllMembersRole(policyGroup.id)
      greeter = await GroupRole.forge({ group_id: policyGroup.id, name: 'Greeter', emoji: '🙌', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    })

    afterEach(() => GroupRole.setInvitePolicy(policyGroup.id, 'stewards'))

    it('starts every group on stewards', async () => {
      expect(await GroupRole.getInvitePolicy(policyGroup.id)).to.equal('stewards')
    })

    it('links Add Members on All Members for everyone and leaves other roles', async () => {
      await GroupRoleResponsibility.forge({ group_role_id: greeter.id, responsibility_id: addMembersId }).save()
      const policy = await GroupRole.setInvitePolicy(policyGroup.id, 'everyone')
      expect(policy).to.equal('everyone')
      expect(await addMembersLinks(policyGroup.id)).to.include(allMembers.id)
      expect(await addMembersLinks(policyGroup.id)).to.include(greeter.id)

      await GroupRole.setInvitePolicy(policyGroup.id, 'stewards')
      const after = await addMembersLinks(policyGroup.id)
      expect(after).to.not.include(allMembers.id)
      expect(after).to.include(greeter.id)
      await bookshelf.knex('group_roles_responsibilities').where({ group_role_id: greeter.id, responsibility_id: addMembersId }).del()
    })

    it('does not change another group', async () => {
      await GroupRole.setInvitePolicy(otherGroup.id, 'everyone')
      await GroupRole.setInvitePolicy(policyGroup.id, 'stewards')
      expect(await GroupRole.getInvitePolicy(otherGroup.id)).to.equal('everyone')
      await GroupRole.setInvitePolicy(otherGroup.id, 'stewards')
    })

    it('rejects an unknown policy, spaces and missing groups', async () => {
      await expect(GroupRole.setInvitePolicy(policyGroup.id, 'roles')).to.be.rejectedWith('Unknown invite policy')
      await expect(GroupRole.setInvitePolicy(space.id, 'everyone')).to.be.rejectedWith('Only top-level groups have an invite policy')
      await expect(GroupRole.setInvitePolicy(99999999, 'stewards')).to.be.rejectedWith('Group not found')
      expect(await GroupRole.getInvitePolicy(space.id)).to.be.null
    })

    it('saves everyone when a group is created with that policy', async () => {
      const created = await Group.create(user.id, {
        name: 'Everyone Invites',
        slug: `everyone-invites-${Date.now()}`,
        invite_policy: 'everyone'
      })
      expect(await GroupRole.getInvitePolicy(created.id)).to.equal('everyone')
    })

    it('never duplicates the All Members link when set concurrently', async () => {
      await Promise.all([
        GroupRole.setInvitePolicy(policyGroup.id, 'everyone'),
        GroupRole.setInvitePolicy(policyGroup.id, 'everyone'),
        bookshelf.transaction(transacting => GroupRole.setInvitePolicy(policyGroup.id, 'everyone', { transacting }))
      ])
      const links = await bookshelf.knex('group_roles_responsibilities')
        .where({ group_role_id: allMembers.id, responsibility_id: addMembersId })
      expect(links).to.have.lengthOf(1)
    })
  })
})
