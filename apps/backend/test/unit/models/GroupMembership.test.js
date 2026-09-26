/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const { spyify, unspyify } = require(root('test/setup/helpers'))
const factories = require(root('test/setup/factories'))

describe('GroupMembership', () => {
  before(async () => setup.clearDb())

  describe('forPair', () => {
    let g, u

    before(async () => {
      g = await factories.group().save()
      u = await factories.user().save()
    })

    it('should throw if no user', () => {
      expect(() => GroupMembership.forPair()).to.throw(/user or user id/)
    })

    it('should throw if no instance', () => {
      expect(() => GroupMembership.forPair(u)).to.throw(/without a group/)
    })

    it('should invoke forIds with the correct ids and model', async () => {
      spyify(GroupMembership, 'forIds')
      await GroupMembership.forPair(u, g)
      expect(GroupMembership.forIds).to.have.been.called.with(u.id, g.id, {})
      unspyify(GroupMembership, 'forIds')
    })
  })

  describe('hasActiveMembership', () => {
    let u, g1, g2, gm

    before(async () => {
      u = await factories.user().save()
      g1 = await factories.group().save()
      g2 = await factories.group().save()
      gm = await u.joinGroup(g1)
    })

    it('returns true if user is a member', async () => {
      const actual = await GroupMembership.hasActiveMembership(u, g1)
      expect(actual).to.equal(true)
    })

    it('returns false if user is not a member', async () => {
      const actual = await GroupMembership.hasActiveMembership(u, g2)
      expect(actual).to.equal(false)
    })

    it('returns false if user is an inactive member', async () => {
      await gm.updateAndSave({ active: false })
      const actual = await GroupMembership.hasActiveMembership(u, g1)
      expect(actual).to.equal(false)
    })
  })

  describe('inviteAccess', () => {
    let group, space, administrator, host, addMembersHolder, moderator, member, outsider, roles

    async function assignRole (user, role) {
      return MemberGroupRole.forge({ user_id: user.id, group_id: group.id, group_role_id: role.id, active: true }).save()
    }

    before(async () => {
      group = await factories.group().save()
      space = await factories.group({ type: 'space', parent_id: group.id }).save()
      ;[administrator, host, addMembersHolder, moderator, member, outsider] = await Promise.all(
        [1, 2, 3, 4, 5, 6].map(() => factories.user().save())
      )
      await administrator.joinGroup(group, { assignAdministrator: true })
      for (const user of [host, addMembersHolder, moderator, member]) {
        await user.joinGroup(group)
      }
      await member.joinGroup(space)

      roles = {
        member: await GroupRole.findMemberRole(group.id),
        host: await GroupRole.findSystemRole(group.id, 'Host'),
        moderator: await GroupRole.findSystemRole(group.id, 'Moderator'),
        addMembers: await GroupRole.forge({ group_id: group.id, name: 'Door Keeper', emoji: '🚪', type: GroupRole.TYPE_CUSTOM, active: true }).save()
      }
      const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
      await GroupRoleResponsibility.forge({ group_role_id: roles.addMembers.id, responsibility_id: addMembersId }).save()
      await assignRole(host, roles.host)
      await assignRole(addMembersHolder, roles.addMembers)
      await assignRole(moderator, roles.moderator)
    })

    afterEach(() => GroupRole.setInvitePolicy(group.id, { mode: 'stewards' }))

    it('is full for Administrators, Hosts and custom roles with Add Members, whatever the policy', async () => {
      for (const mode of ['stewards', 'everyone']) {
        await GroupRole.setInvitePolicy(group.id, { mode })
        for (const user of [administrator, host, addMembersHolder]) {
          expect(await GroupMembership.inviteAccess(user.id, group)).to.equal('full')
        }
      }
    })

    it('is limited for every active member when the policy is everyone, and null on stewards', async () => {
      expect(await GroupMembership.inviteAccess(member.id, group.id)).to.be.null
      expect(await GroupMembership.inviteAccess(moderator, group)).to.be.null

      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      expect(await GroupMembership.inviteAccess(member.id, group.id)).to.equal('limited')
      expect(await GroupMembership.inviteAccess(moderator, group)).to.equal('limited')
    })

    it('is null for people outside the group and for missing ids', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      expect(await GroupMembership.inviteAccess(outsider.id, group.id)).to.be.null
      expect(await GroupMembership.inviteAccess(null, group.id)).to.be.null
      expect(await GroupMembership.inviteAccess(member.id, null)).to.be.null
      expect(await GroupMembership.inviteAccess(member.id, 99999999)).to.be.null
    })

    it('is null for an inactive membership and after leaving', async () => {
      const leaver = await factories.user().save()
      const membership = await leaver.joinGroup(group)
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      expect(await GroupMembership.inviteAccess(leaver.id, group.id)).to.equal('limited')

      await membership.save({ active: false }, { patch: true })
      expect(await GroupMembership.inviteAccess(leaver.id, group.id)).to.be.null

      await membership.save({ active: true }, { patch: true })
      await group.removeMembers([leaver.id])
      expect(await GroupMembership.inviteAccess(leaver.id, group.id)).to.be.null
    })

    it('is limited for holders of the chosen roles, and null when the role or assignment is inactive', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'roles', roleIds: [roles.moderator.id] })
      expect(await GroupMembership.inviteAccess(moderator.id, group.id)).to.equal('limited')
      expect(await GroupMembership.inviteAccess(member.id, group.id)).to.be.null

      await roles.moderator.save({ active: false }, { patch: true })
      expect(await GroupMembership.inviteAccess(moderator.id, group.id)).to.be.null
      await roles.moderator.save({ active: true }, { patch: true })

      const assignment = () => bookshelf.knex('group_memberships_group_roles')
        .where({ user_id: moderator.id, group_role_id: roles.moderator.id })
      await assignment().update({ active: false })
      expect(await GroupMembership.inviteAccess(moderator.id, group.id)).to.be.null
      await assignment().update({ active: null })
      expect(await GroupMembership.inviteAccess(moderator.id, group.id)).to.equal('limited')
      await assignment().update({ active: true })
    })

    it('is null when the Member role is deactivated', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      await roles.member.save({ active: false }, { patch: true })
      try {
        expect(await GroupMembership.inviteAccess(member.id, group.id)).to.be.null
      } finally {
        await roles.member.save({ active: true }, { patch: true })
      }
    })

    it('is null in spaces unless the person has full access', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      expect(await GroupMembership.inviteAccess(member.id, space.id)).to.be.null
      expect(await GroupMembership.inviteAccess(administrator.id, space.id)).to.equal('full')
      expect(await GroupMembership.inviteAccess(host.id, space)).to.equal('full')
    })

    it('ignores a group-defined responsibility titled Invite Members', async () => {
      const [lookalikeId] = await bookshelf.knex('responsibilities')
        .insert({ title: Responsibility.constants.RESP_INVITE_MEMBERS, type: 'custom', group_id: group.id, created_at: new Date(), updated_at: new Date() })
        .returning('id')
        .then(rows => rows.map(row => row.id ?? row))
      const greeter = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '🙌', type: GroupRole.TYPE_CUSTOM, active: true }).save()
      await GroupRoleResponsibility.forge({ group_role_id: greeter.id, responsibility_id: lookalikeId }).save()
      await GroupRoleResponsibility.forge({ group_role_id: roles.member.id, responsibility_id: lookalikeId }).save()
      await assignRole(member, greeter)

      try {
        expect(await GroupMembership.inviteAccess(member.id, group.id)).to.be.null
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      } finally {
        await bookshelf.knex('group_memberships_group_roles').where({ group_role_id: greeter.id }).del()
        await bookshelf.knex('group_roles_responsibilities').where({ responsibility_id: lookalikeId }).del()
        await bookshelf.knex('responsibilities').where({ id: lookalikeId }).del()
      }
    })

    it('never lets a Member role link reach hasResponsibility', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      const administrationId = await Responsibility.systemId(Responsibility.constants.RESP_ADMINISTRATION)
      await GroupRoleResponsibility.forge({ group_role_id: roles.member.id, responsibility_id: administrationId }).save()

      try {
        expect(await Responsibility.fetchForUserAndGroupAsStrings(member.id, group.id)).to.deep.equal([])
        expect(await GroupMembership.hasResponsibility(member.id, group.id, Responsibility.constants.RESP_ADMINISTRATION)).to.be.false
        expect(await GroupMembership.hasResponsibility(member.id, group.id, Responsibility.constants.RESP_INVITE_MEMBERS)).to.be.false
        expect(await GroupMembership.inviteAccess(member.id, group.id)).to.equal('limited')
      } finally {
        await bookshelf.knex('group_roles_responsibilities')
          .where({ group_role_id: roles.member.id, responsibility_id: administrationId })
          .del()
      }
    })
  })

  describe('updateLastViewedAt', () => {
    let u, g1, gm

    before(async () => {
      u = await factories.user().save()
      g1 = await factories.group().save()
      gm = await u.joinGroup(g1)
    })

    it('resets the new post count when no views are unread', async () => {
      await gm.save({ new_post_count: 1 })
      await GroupMembership.updateLastViewedAt(u, g1)
      await gm.refresh()
      expect(gm.get('new_post_count')).to.equal(0)
    })

    it('keeps the chat unread count instead of zeroing on visit', async () => {
      const view = await GroupView.forge({
        group_id: g1.id,
        type: GroupView.Type.CHAT,
        name: 'Chat',
        order: 0
      }).save()
      await GroupViewUser.forge({
        view_id: view.id,
        user_id: u.id,
        new_post_count: 4
      }).save()
      await gm.save({ new_post_count: 0 })
      await GroupMembership.updateLastViewedAt(u, g1)
      await gm.refresh()
      expect(gm.get('new_post_count')).to.equal(4)
    })
  })

  describe('syncBadgeCounts', () => {
    it('sets membership to chat unread plus one per other unread typed view', async () => {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await user.joinGroup(group)
      const chat = await GroupView.forge({
        group_id: group.id,
        type: GroupView.Type.CHAT,
        name: 'Chat',
        order: 0
      }).save()
      const discussions = await GroupView.forge({
        group_id: group.id,
        type: 'discussions',
        name: 'Discussions',
        order: 1
      }).save()
      await GroupViewUser.forge({ view_id: chat.id, user_id: user.id, new_post_count: 7 }).save()
      await GroupViewUser.forge({ view_id: discussions.id, user_id: user.id, new_post_count: 3 }).save()

      await GroupMembership.syncBadgeCounts(group.id, [user.id])
      const membership = await GroupMembership.forPair(user, group).fetch()
      expect(membership.get('new_post_count')).to.equal(8)
    })
  })

  describe('unpinGroupFromAllNavs', () => {
    it('clears the pin and compact remaining nav order for every member', async () => {
      const group = await factories.group().save()
      const otherGroup = await factories.group().save()
      const userA = await factories.user().save()
      const userB = await factories.user().save()
      await userA.joinGroup(group)
      await userA.joinGroup(otherGroup)
      await userB.joinGroup(group)
      await userB.joinGroup(otherGroup)

      await GroupMembership.forPair(userA.id, otherGroup.id).fetch().then(m => m.save({ nav_order: 0 }))
      await GroupMembership.forPair(userA.id, group.id).fetch().then(m => m.save({ nav_order: 1 }))
      await GroupMembership.forPair(userB.id, group.id).fetch().then(m => m.save({ nav_order: 0 }))
      await GroupMembership.forPair(userB.id, otherGroup.id).fetch().then(m => m.save({ nav_order: 1 }))

      await GroupMembership.unpinGroupFromAllNavs(group.id)

      const userAConverted = await GroupMembership.forPair(userA.id, group.id).fetch()
      const userAOther = await GroupMembership.forPair(userA.id, otherGroup.id).fetch()
      const userBConverted = await GroupMembership.forPair(userB.id, group.id).fetch()
      const userBOther = await GroupMembership.forPair(userB.id, otherGroup.id).fetch()

      expect(userAConverted.get('nav_order')).to.be.null
      expect(userAOther.get('nav_order')).to.equal(0)
      expect(userBConverted.get('nav_order')).to.be.null
      expect(userBOther.get('nav_order')).to.equal(0)
    })
  })
})
