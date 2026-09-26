/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { withFeatureFlag } from '../../setup/helpers'

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

  describe('invite policy', () => {
    const INVALID_ROLES_ERROR = 'Invite policy roles must be active roles in this group'
    let policyGroup, otherGroup, inviteMembersId, roles

    // Ids of this group's roles linked to Invite Members, one entry per link row
    async function inviteMembersLinks (groupId) {
      const rows = await bookshelf.knex('group_roles_responsibilities as grr')
        .join('groups_roles as gr', 'gr.id', 'grr.group_role_id')
        .where({ 'gr.group_id': groupId, 'grr.responsibility_id': inviteMembersId })
        .orderBy('gr.id')
        .select('gr.id')
      return rows.map(row => Number(row.id))
    }

    before(async () => {
      policyGroup = await factories.group().save()
      otherGroup = await factories.group().save()
      await GroupRole.setupSystemRoles(policyGroup.id)
      await GroupRole.setupSystemRoles(otherGroup.id)
      inviteMembersId = await Responsibility.systemId(Responsibility.constants.RESP_INVITE_MEMBERS)
      roles = {
        member: await GroupRole.findMemberRole(policyGroup.id),
        administrator: await GroupRole.findSystemRole(policyGroup.id, 'Administrator'),
        moderator: await GroupRole.findSystemRole(policyGroup.id, 'Moderator'),
        host: await GroupRole.findSystemRole(policyGroup.id, 'Host'),
        greeter: await GroupRole.forge({ group_id: policyGroup.id, name: 'Greeter', emoji: '🙌', type: GroupRole.TYPE_CUSTOM, active: true }).save(),
        otherModerator: await GroupRole.findSystemRole(otherGroup.id, 'Moderator'),
        otherMember: await GroupRole.findMemberRole(otherGroup.id)
      }
    })

    afterEach(async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })
      await roles.greeter.save({ active: true }, { patch: true })
    })

    it('starts every group on stewards', async () => {
      expect(await GroupRole.getInvitePolicy(policyGroup.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([])
    })

    it('links exactly the Member role for everyone', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] })
      const policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })

      expect(policy).to.deep.equal({ mode: 'everyone', roleIds: [] })
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.member.id])
    })

    it('links exactly the chosen roles for roles', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      let policy = await GroupRole.setInvitePolicy(policyGroup.id, {
        mode: 'roles',
        roleIds: [String(roles.greeter.id)],
        systemRoleNames: ['Moderator']
      })

      const expected = [roles.moderator.id, roles.greeter.id].sort((a, b) => a - b)
      expect(policy).to.deep.equal({ mode: 'roles', roleIds: expected })
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal(expected)

      policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] })
      expect(policy).to.deep.equal({ mode: 'roles', roleIds: [roles.greeter.id] })
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.greeter.id])
    })

    it('unlinks every role for stewards', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.moderator.id, roles.greeter.id] })
      await GroupRoleResponsibility.forge({ group_role_id: roles.member.id, responsibility_id: inviteMembersId }).save()

      const policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })
      expect(policy).to.deep.equal({ mode: 'stewards', roleIds: [] })
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([])
    })

    it('leaves other responsibilities and other groups alone', async () => {
      await GroupRole.setInvitePolicy(otherGroup.id, { mode: 'everyone' })
      const moderatorBefore = await linkedResponsibilityIds(roles.moderator.id)

      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', systemRoleNames: ['Moderator'] })
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })

      expect(await linkedResponsibilityIds(roles.moderator.id)).to.deep.equal(moderatorBefore)
      expect(await inviteMembersLinks(otherGroup.id)).to.deep.equal([roles.otherMember.id])
      await GroupRole.setInvitePolicy(otherGroup.id, { mode: 'stewards' })
    })

    it('rejects roles that are not active roles of this group, and changes nothing', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] })
      const inactive = await GroupRole.forge({ group_id: policyGroup.id, name: 'Retired', emoji: '💤', type: GroupRole.TYPE_CUSTOM, active: false }).save()

      for (const roleIds of [[roles.member.id], [roles.otherModerator.id], [inactive.id], ['abc'], [99999999]]) {
        await expect(GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.moderator.id, ...roleIds] }))
          .to.be.rejectedWith(INVALID_ROLES_ERROR)
      }
      await expect(GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', systemRoleNames: ['Member'] }))
        .to.be.rejectedWith('Unknown system role: Member')
      await expect(GroupRole.setInvitePolicy(policyGroup.id, { mode: 'anyone' }))
        .to.be.rejectedWith('Unknown invite policy mode')
      await expect(GroupRole.setInvitePolicy(policyGroup.id, {}))
        .to.be.rejectedWith('Unknown invite policy mode')

      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.greeter.id])
    })

    it('rejects spaces and missing groups', async () => {
      await expect(GroupRole.setInvitePolicy(space.id, { mode: 'everyone' }))
        .to.be.rejectedWith('Only top-level groups have an invite policy')
      await expect(GroupRole.setInvitePolicy(space.id, { mode: 'stewards' }))
        .to.be.rejectedWith('Only top-level groups have an invite policy')
      await expect(GroupRole.setInvitePolicy(99999999, { mode: 'stewards' }))
        .to.be.rejectedWith('Group not found')
      expect(await GroupRole.getInvitePolicy(space.id)).to.be.null
      expect(await GroupRole.getInvitePolicy(99999999)).to.be.null
    })

    it('keeps setupSystemRoles from linking or unlinking the Member role', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      await GroupRole.setupSystemRoles(policyGroup.id)
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.member.id])
      expect(await linkedResponsibilityIds(roles.member.id)).to.deep.equal([inviteMembersId])

      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })
      await GroupRole.setupSystemRoles(policyGroup.id)
      expect(await linkedResponsibilityIds(roles.member.id)).to.deep.equal([])
    })

    it('creates a missing Member role for everyone', async () => {
      const olderGroup = await factories.group().save()
      await GroupRole.setupSystemRoles(olderGroup.id)
      await bookshelf.knex('groups_roles').where({ group_id: olderGroup.id, type: GroupRole.TYPE_MEMBER }).del()
      expect(await GroupRole.getInvitePolicy(olderGroup.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })

      const policy = await GroupRole.setInvitePolicy(olderGroup.id, { mode: 'everyone' })
      const memberRole = await GroupRole.findMemberRole(olderGroup.id)
      expect(policy.mode).to.equal('everyone')
      expect(await inviteMembersLinks(olderGroup.id)).to.deep.equal([memberRole.id])
    })

    it('resolves systemRoleNames when a group is created', async () => {
      const created = await Group.create(user.id, {
        name: 'Moderators Invite',
        slug: `moderators-invite-${Date.now()}`,
        invite_policy: { mode: 'roles', system_role_names: ['Moderator'] }
      })
      const moderator = await GroupRole.findSystemRole(created.id, 'Moderator')

      expect(await GroupRole.getInvitePolicy(created.id)).to.deep.equal({ mode: 'roles', roleIds: [moderator.id] })
    })

    it('reads roles that also hold Add Members as stewards', async () => {
      let policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.host.id] })
      expect(policy).to.deep.equal({ mode: 'stewards', roleIds: [] })

      policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', systemRoleNames: ['Administrator', 'Moderator'] })
      expect(policy).to.deep.equal({ mode: 'roles', roleIds: [roles.administrator.id, roles.moderator.id].sort((a, b) => a - b) })
    })

    it('ignores inactive roles', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] })
      await roles.greeter.save({ active: false }, { patch: true })
      expect(await GroupRole.getInvitePolicy(policyGroup.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })

      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      await roles.member.save({ active: false }, { patch: true })
      expect(await GroupRole.getInvitePolicy(policyGroup.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      await roles.member.save({ active: true }, { patch: true })
    })

    it('reports roles for a custom role given Invite Members in Roles & Badges', async () => {
      await GroupRoleResponsibility.forge({ group_role_id: roles.greeter.id, responsibility_id: inviteMembersId }).save()
      expect(await GroupRole.getInvitePolicy(policyGroup.id)).to.deep.equal({ mode: 'roles', roleIds: [roles.greeter.id] })
    })

    it('only sets stewards while member invitations are switched off, and changes nothing else', async () => {
      await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] })

      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        expect(GroupRole.memberInvitesEnabled()).to.equal(false)
        await expect(GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }))
          .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
        await expect(GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', systemRoleNames: ['Moderator'] }))
          .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
        await expect(bookshelf.transaction(transacting =>
          GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }, { transacting })))
          .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
        expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.greeter.id])

        const policy = await GroupRole.setInvitePolicy(policyGroup.id, { mode: 'stewards' })
        expect(policy).to.deep.equal({ mode: 'stewards', roleIds: [] })
        expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([])
      })
    })

    it('rejects a new group with an everyone or roles policy while member invitations are switched off', async () => {
      await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
        for (const invitePolicy of [{ mode: 'everyone' }, { mode: 'roles', system_role_names: ['Moderator'] }]) {
          const slug = `switched-off-${invitePolicy.mode}-${Date.now()}`
          await expect(Group.create(user.id, { name: 'Switched Off', slug, invite_policy: invitePolicy }))
            .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
          expect(await Group.where({ slug }).fetch()).to.not.exist
        }

        const created = await Group.create(user.id, { name: 'Switched Off Stewards', slug: `switched-off-stewards-${Date.now()}` })
        expect(await GroupRole.getInvitePolicy(created.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      })
    })

    it('never duplicates links when changed concurrently', async () => {
      await Promise.all([
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }),
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }),
        bookshelf.transaction(transacting => GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }, { transacting })),
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }),
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' })
      ])
      expect(await inviteMembersLinks(policyGroup.id)).to.deep.equal([roles.member.id])

      await Promise.all([
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.greeter.id] }),
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'everyone' }),
        GroupRole.setInvitePolicy(policyGroup.id, { mode: 'roles', roleIds: [roles.moderator.id] })
      ])
      const links = await inviteMembersLinks(policyGroup.id)
      expect(links).to.have.lengthOf(1)
      expect([[roles.greeter.id], [roles.member.id], [roles.moderator.id]]).to.deep.include(links)
    })
  })
})
