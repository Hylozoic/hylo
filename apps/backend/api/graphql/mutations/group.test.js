/* eslint-disable no-unused-expressions */
import factories from '../../../test/setup/factories'
import { withFeatureFlag } from '../../../test/setup/helpers'

import {
  addMember,
  createGroup,
  joinGroup,
  updateGroup,
  removeMember,
  regenerateAccessCode,
  deleteGroupTopic,
  deleteGroup,
  invitePeerRelationship,
  updatePeerRelationship,
  deletePeerRelationship,
  acceptGroupRelationshipInvite,
  cancelGroupRelationshipInvite,
  rejectGroupRelationshipInvite
} from './group'
import { addSuggestedSkillToGroup, leaveGroup, removeSuggestedSkillFromGroup } from './index'

describe('mutations/group', () => {
  describe('moderation', () => {
    let user, group

    before(function () {
      user = factories.user()
      group = factories.group()
      return Promise.join(group.save(), user.save())
        .then(() => user.joinGroup(group, { assignAdministrator: true }))
    })

    describe('updateGroup', () => {
      it('rejects if name is blank', () => {
        const data = { name: '   ' }
        return updateGroup(user.id, group.id, data)
          .then(() => expect.fail('should reject'))
          .catch(e => expect(e.message).to.match(/Name cannot be blank/))
      })

      it('rejects if user is not a steward', () => {
        const data = { name: 'whee' }
        return updateGroup('777', group.id, data)
          .then(() => expect.fail('should reject'))
          .catch(e => expect(e.message).to.match(/You don't have the right responsibilities for this group/))
      })
    })

    describe('removeMember', () => {
      it('works', async () => {
        const user2 = await factories.user().save()
        await user2.joinGroup(group, { assignAdministrator: true })
        await removeMember(user.id, user2.id, group.id)

        const membership = await GroupMembership.forPair(user2, group,
          { includeInactive: true }).fetch()
        expect(membership.get('active')).to.be.false

        const roles = await MemberGroupRole.where({ user_id: user2.id, group_id: group.id }).fetchAll()
        expect(roles.length).to.equal(0)
        expect(await GroupMembership.hasResponsibility(user2.id, group, Responsibility.constants.RESP_ADMINISTRATION)).to.be.false
      })
    })

    describe('keeping an Administrator', () => {
      let soloGroup, administrator, moderator

      beforeEach(async () => {
        administrator = await factories.user().save()
        moderator = await factories.user().save()
        soloGroup = await factories.group().save()
        await administrator.joinGroup(soloGroup, { assignAdministrator: true })
        await moderator.joinGroup(soloGroup)
        const moderatorRole = await GroupRole.findSystemRole(soloGroup.id, 'Moderator')
        await MemberGroupRole.forge({ user_id: moderator.id, group_id: soloGroup.id, group_role_id: moderatorRole.id, active: true }).save()
      })

      it('stops a Moderator removing the only Administrator', async () => {
        await expect(removeMember(moderator.id, administrator.id, soloGroup.id))
          .to.be.rejectedWith('A group must keep at least one Administrator')
        expect(await GroupMembership.hasActiveMembership(administrator.id, soloGroup.id)).to.be.true
      })

      it('lets an Administrator be removed when another remains', async () => {
        const second = await factories.user().save()
        await second.joinGroup(soloGroup, { assignAdministrator: true })
        await removeMember(moderator.id, administrator.id, soloGroup.id)
        expect(await GroupMembership.hasActiveMembership(administrator.id, soloGroup.id)).to.be.false
      })

      it('never stops the only Administrator leaving', async () => {
        await leaveGroup(administrator.id, soloGroup.id)
        expect(await GroupMembership.hasActiveMembership(administrator.id, soloGroup.id)).to.be.false
      })

      it('never stops the only Administrator removing themselves', async () => {
        await removeMember(administrator.id, administrator.id, soloGroup.id)
        expect(await GroupMembership.hasActiveMembership(administrator.id, soloGroup.id)).to.be.false
      })
    })

    describe('regenerateAccessCode', () => {
      it('works', async () => {
        const code = group.get('access_code')
        await regenerateAccessCode(user.id, group.id)
        await group.refresh()
        expect(group.get('access_code')).not.to.equal(code)
      })
    })
  })

  describe('joinGroup', () => {
    it('assigns the invitation group role when joining with an invitation token', async () => {
      const inviter = await factories.user().save()
      const user = await factories.user().save()
      const group = await factories.group().save({ accessibility: Group.Accessibility.RESTRICTED })
      await inviter.joinGroup(group, { assignAdministrator: true })
      await GroupRole.setupSystemRoles(group.id)
      const hostRole = await GroupRole.findSystemRole(group.id, 'Host')

      const invitation = await Invitation.create({
        userId: inviter.id,
        groupId: group.id,
        email: user.get('email'),
        groupRoleId: hostRole.id
      })

      await joinGroup(group.id, user.id, [], null, invitation.get('token'), false, {})

      const memberRole = await MemberGroupRole.where({
        user_id: user.id,
        group_id: group.id,
        group_role_id: hostRole.id,
        active: true
      }).fetch()
      expect(memberRole).to.exist

      const canAddMembers = await GroupMembership.hasResponsibility(
        user.id,
        group,
        Responsibility.constants.RESP_ADD_MEMBERS
      )
      expect(canAddMembers).to.be.true
    })

    it('adds the user to the space after joining the parent with a space invitation', async () => {
      const inviter = await factories.user().save()
      const user = await factories.user().save()
      const parent = await factories.group().save({ accessibility: Group.Accessibility.RESTRICTED })
      const space = await factories.group({ type: 'space', parent_id: parent.id }).save()
      await inviter.joinGroup(parent, { assignAdministrator: true })

      const invitation = await Invitation.create({
        userId: inviter.id,
        groupId: space.id,
        email: user.get('email')
      })

      await joinGroup(parent.id, user.id, [], null, invitation.get('token'), false, {})

      const parentMembership = await GroupMembership.forPair(user, parent).fetch()
      const spaceMembership = await GroupMembership.forPair(user, space).fetch()
      expect(parentMembership).to.exist
      expect(spaceMembership).to.exist

      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.equal(user.id)
    })

    describe('with a member invitation', () => {
      let sponsor

      const memberInvitation = (group, email) =>
        Invitation.create({ userId: sponsor.id, groupId: group.id, email, inviterAccess: Invitation.InviterAccess.LIMITED })

      const expectNotJoined = async (user, group) =>
        expect(await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()).to.not.exist

      before(async () => {
        sponsor = await factories.user().save()
      })

      it('does not pre-approve a Restricted or Closed group', async () => {
        for (const accessibility of [Group.Accessibility.RESTRICTED, Group.Accessibility.CLOSED]) {
          const user = await factories.user().save()
          const group = await factories.group({ accessibility }).save()
          const invitation = await memberInvitation(group, user.get('email'))

          await expect(joinGroup(group.id, user.id, [], null, invitation.get('token'), false, {}))
            .to.be.rejectedWith('You do not have permission to do that')
          await expectNotJoined(user, group)
          await invitation.refresh()
          expect(invitation.get('used_by_id')).to.be.null
        }
      })

      it('joins an Open group and marks the invitation used', async () => {
        const user = await factories.user().save()
        const group = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
        const invitation = await memberInvitation(group, 'another-address@member-invite.com')

        const membership = await joinGroup(group.id, user.id, [], null, invitation.get('token'), false, {})
        expect(membership.get('group_id')).to.equal(group.id)
        await invitation.refresh()
        expect(invitation.get('used_by_id')).to.equal(user.id)
      })

      it('never uses it to join its own group while joining another one', async () => {
        const user = await factories.user().save()
        const invitedTo = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
        const invitation = await memberInvitation(invitedTo, user.get('email'))
        const withJoinLink = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
        const open = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()

        await joinGroup(withJoinLink.id, user.id, [], withJoinLink.get('access_code'), invitation.get('token'), false, {})
        await joinGroup(open.id, user.id, [], null, invitation.get('token'), false, {})

        expect(await GroupMembership.forPair(user, withJoinLink).fetch()).to.exist
        expect(await GroupMembership.forPair(user, open).fetch()).to.exist
        await expectNotJoined(user, invitedTo)
        await invitation.refresh()
        expect(invitation.get('used_by_id')).to.be.null
      })

      it('does not let a member invitation to a space pre-approve its parent', async () => {
        const user = await factories.user().save()
        const parent = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
        const space = await factories.group({ type: 'space', parent_id: parent.id, accessibility: Group.Accessibility.OPEN }).save()
        const invitation = await memberInvitation(space, user.get('email'))

        await expect(joinGroup(parent.id, user.id, [], null, invitation.get('token'), false, {}))
          .to.be.rejectedWith('You do not have permission to do that')
        await expectNotJoined(user, parent)
        await expectNotJoined(user, space)
      })
    })

    describe('join attribution', () => {
      let inviter, group

      before(async () => {
        inviter = await factories.user().save()
        group = await factories.group().save({ accessibility: Group.Accessibility.OPEN })
        await inviter.joinGroup(group, { assignAdministrator: true })
      })

      it('records open when joining without a code or invitation', async () => {
        const user = await factories.user().save()
        const membership = await joinGroup(group.id, user.id, [], null, null, false, {})
        expect(membership.getSetting('joinSource')).to.equal('open')
      })

      it('records invite_link when joining with the access code', async () => {
        const user = await factories.user().save()
        const membership = await joinGroup(group.id, user.id, [], group.get('access_code'), null, false, {})
        expect(membership.getSetting('joinSource')).to.equal('invite_link')
      })

      it('records the invitation and inviter when joining with an invitation token', async () => {
        const user = await factories.user().save()
        const invitation = await Invitation.create({ userId: inviter.id, groupId: group.id, email: user.get('email') })
        await joinGroup(group.id, user.id, [], null, invitation.get('token'), false, {})
        const membership = await GroupMembership.forPair(user, group).fetch()
        expect(membership.getSetting('joinSource')).to.equal('email_invite')
        expect(membership.getSetting('invitationId')).to.equal(invitation.id)
        expect(membership.getSetting('invitedById')).to.equal(inviter.id)
      })
    })
  })

  describe('addMember', () => {
    it('records admin_add as the join source', async () => {
      const user = await factories.user().save()
      const group = await factories.group().save()
      const result = await addMember(user.id, group.id)
      expect(result.success).to.be.true
      const membership = await GroupMembership.forPair(user, group).fetch()
      expect(membership.getSetting('joinSource')).to.equal('admin_add')
    })
  })

  describe('createGroup', () => {
    let user, starterGroup

    before(async () => {
      starterGroup = await factories.group().save({ slug: 'starter-posts', access_code: 'aasdfkjh3##Sasdfsdfedss', accessibility: Group.Accessibility.OPEN })
      const starterPost = await factories.post().save()
      await starterGroup.posts().attach(starterPost.id)
      user = await factories.user().save()
      await starterGroup.addMembers([user])
    })

    it('setups up the new administrator membership correctly', async () => {
      const group = await createGroup(user.id, {
        name: 'Foo',
        slug: 'foob',
        description: 'Here be foo'
      })

      const membership = await group.memberships().fetchOne()

      expect(group).to.exist
      expect(group.get('slug')).to.equal('foob')
      expect(membership).to.exist
      // TODO: improve this test
      const hasAdministration = await GroupMembership.hasResponsibility(user.id, group, Responsibility.constants.RESP_ADMINISTRATION)
      expect(hasAdministration).to.be.true

      const chatView = await GroupView.where({ group_id: group.id, type: GroupView.Type.CHAT }).fetch()
      expect(chatView).to.exist
    })

    it('creates inside a parent group if user can moderate the parent or parent is open', () => {
      const childGroup = { name: 'goose', slug: 'goose', parent_ids: [starterGroup.id] }
      return createGroup(user.id, childGroup)
        .then(async (group) => {
          expect(group).to.exist
          expect(Number((await group.parentGroups().fetch()).length)).to.equal(1)

          const newChildGroup = { name: 'gander', slug: 'gander', parent_ids: [group.id] }
          createGroup(user.id, newChildGroup).then(async (g2) => {
            expect(g2).to.exist
            expect(Number((await g2.parentGroups().fetch()).length)).to.equal(1)
          })
        })
    })
  })

  describe('deleteGroupTopic', () => {
    let user, group

    before(function () {
      user = factories.user()
      group = factories.group()
      return Promise.join(group.save(), user.save())
        .then(() => user.joinGroup(group, { assignAdministrator: true }))
    })

    it('deletes the topic', async () => {
      const topic = await factories.tag().save()
      const groupTopic = await GroupTag.create({
        group_id: group.id,
        tag_id: topic.id
      })
      await deleteGroupTopic(user.id, groupTopic.id)
      const searched = await GroupTag.where({ id: groupTopic.id }).fetch()
      expect(searched).not.to.exist
    })
  })

  describe('deleteGroup', () => {
    let user, group

    before(async () => {
      user = await factories.user().save()
      group = await factories.group().save()
      await user.joinGroup(group, { assignAdministrator: true })
    })

    it('makes the group inactive', async () => {
      await deleteGroup(user.id, group.id)

      const foundGroup = await Group.find(group.id)
      expect(foundGroup.get('active')).to.be.false
    })
  })

  describe('peer-to-peer relationships', () => {
    let adminUser, memberUser, fromGroup, toGroup, otherGroup

    before(async () => {
      // Clean up any existing relationships that might be left over from previous test runs
      await bookshelf.knex('group_relationships').where('id', '>', 0).del()
      await bookshelf.knex('group_relationship_invites').where('id', '>', 0).del()

      adminUser = await factories.user().save()
      memberUser = await factories.user().save()
      fromGroup = await factories.group().save()
      toGroup = await factories.group().save()
      otherGroup = await factories.group().save()

      // Make adminUser an administrator of both fromGroup and toGroup
      await adminUser.joinGroup(fromGroup, { assignAdministrator: true })
      await adminUser.joinGroup(toGroup, { assignAdministrator: true })

      // Make memberUser a regular member of fromGroup only
      await memberUser.joinGroup(fromGroup, { assignAdministrator: false })
    })

    beforeEach(async () => {
      await bookshelf.knex('group_relationships').where('id', '>', 0).del()
      await bookshelf.knex('group_relationship_invites').where('id', '>', 0).del()
    })

    describe('invitePeerRelationship', () => {
      it('creates direct relationship when user is admin of both groups', async () => {
        const result = await invitePeerRelationship(adminUser.id, fromGroup.id, toGroup.id, 'Alliance partnership')

        expect(result.success).to.be.true
        expect(result.groupRelationship).to.exist
        expect(result.groupRelationship.get('parent_group_id')).to.equal(fromGroup.id)
        expect(result.groupRelationship.get('child_group_id')).to.equal(toGroup.id)
        expect(result.groupRelationship.get('relationship_type')).to.equal(Group.RelationshipType.PEER_TO_PEER)
        expect(result.groupRelationship.get('description')).to.equal('Alliance partnership')
        expect(result.groupRelationship.get('active')).to.be.true
      })

      it('creates invitation when user is admin of only one group', async () => {
        const result = await invitePeerRelationship(adminUser.id, fromGroup.id, otherGroup.id, 'Partnership request')

        expect(result.success).to.be.true
        expect(result.groupRelationshipInvite).to.exist
        expect(result.groupRelationshipInvite.get('from_group_id')).to.equal(fromGroup.id)
        expect(result.groupRelationshipInvite.get('to_group_id')).to.equal(otherGroup.id)
        expect(result.groupRelationshipInvite.get('type')).to.equal(GroupRelationshipInvite.TYPE.PeerToPeer)
        expect(result.groupRelationshipInvite.get('message')).to.equal('Partnership request')
        expect(result.groupRelationshipInvite.get('status')).to.equal(GroupRelationshipInvite.STATUS.Pending)
      })

      it('rejects when trying to create relationship with same group', async () => {
        try {
          await invitePeerRelationship(adminUser.id, fromGroup.id, fromGroup.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Cannot create peer relationship between the same group/)
        }
      })

      it('rejects when user is not an admin of the from group', async () => {
        try {
          await invitePeerRelationship(memberUser.id, fromGroup.id, otherGroup.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/You don't have the right responsibilities for this group/)
        }
      })

      it('rejects when target group does not exist', async () => {
        try {
          await invitePeerRelationship(adminUser.id, fromGroup.id, 99999)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Target group not found/)
        }
      })

      it('rejects when groups are already related', async () => {
        // First create a parent-child relationship
        await GroupRelationship.forge({
          parent_group_id: fromGroup.id,
          child_group_id: otherGroup.id,
          relationship_type: Group.RelationshipType.PARENT_CHILD,
          active: true
        }).save()

        try {
          await invitePeerRelationship(adminUser.id, fromGroup.id, otherGroup.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Groups are already related/)
        }

        // Clean up
        await GroupRelationship.where({
          parent_group_id: fromGroup.id,
          child_group_id: otherGroup.id
        }).destroy()
      })

      it('returns existing pending invite if one exists', async () => {
        // Create a pending invite
        const existingInvite = await GroupRelationshipInvite.create({
          userId: adminUser.id,
          fromGroupId: fromGroup.id,
          toGroupId: otherGroup.id,
          type: GroupRelationshipInvite.TYPE.PeerToPeer,
          message: 'Existing invite'
        })

        const result = await invitePeerRelationship(adminUser.id, fromGroup.id, otherGroup.id)

        expect(result.success).to.be.false
        expect(result.groupRelationshipInvite).to.exist
        expect(result.groupRelationshipInvite.get('from_group_id')).to.equal(existingInvite.get('from_group_id'))
        expect(result.groupRelationshipInvite.get('to_group_id')).to.equal(existingInvite.get('to_group_id'))
        expect(result.groupRelationshipInvite.get('status')).to.equal(GroupRelationshipInvite.STATUS.Pending)

        // Clean up
        await existingInvite.destroy()
      })
    })

    describe('updatePeerRelationship', () => {
      let peerRelationship

      beforeEach(async () => {
        // Create a peer relationship for testing
        peerRelationship = await GroupRelationship.forge({
          parent_group_id: fromGroup.id,
          child_group_id: toGroup.id,
          relationship_type: Group.RelationshipType.PEER_TO_PEER,
          description: 'Original description',
          active: true
        }).save()
      })

      afterEach(async () => {
        // Clean up
        if (peerRelationship) {
          await peerRelationship.destroy()
        }
      })

      it('updates description when user is admin of parent group', async () => {
        const updatedRelationship = await updatePeerRelationship(
          adminUser.id,
          peerRelationship.id,
          'Updated alliance description'
        )

        expect(updatedRelationship.get('description')).to.equal('Updated alliance description')
      })

      it('updates description when user is admin of child group', async () => {
        const updatedRelationship = await updatePeerRelationship(
          adminUser.id,
          peerRelationship.id,
          'Partnership updated'
        )

        expect(updatedRelationship.get('description')).to.equal('Partnership updated')
      })

      it('rejects when user is not admin of either group', async () => {
        try {
          await updatePeerRelationship(memberUser.id, peerRelationship.id, 'Unauthorized update')
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/You must be an administrator of one of the groups/)
        }
      })

      it('rejects when relationship does not exist', async () => {
        try {
          await updatePeerRelationship(adminUser.id, 99999, 'Non-existent relationship')
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Relationship not found/)
        }
      })

      it('rejects when trying to update non-peer relationship', async () => {
        // Create a parent-child relationship
        const parentChildRelationship = await GroupRelationship.forge({
          parent_group_id: fromGroup.id,
          child_group_id: otherGroup.id,
          relationship_type: Group.RelationshipType.PARENT_CHILD,
          active: true
        }).save()

        try {
          await updatePeerRelationship(adminUser.id, parentChildRelationship.id, 'Should fail')
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Can only update peer-to-peer relationships/)
        }

        // Clean up
        await parentChildRelationship.destroy()
      })
    })

    describe('deletePeerRelationship', () => {
      let peerRelationship

      beforeEach(async () => {
        // Create a peer relationship for testing
        peerRelationship = await GroupRelationship.forge({
          parent_group_id: fromGroup.id,
          child_group_id: toGroup.id,
          relationship_type: Group.RelationshipType.PEER_TO_PEER,
          description: 'To be deleted',
          active: true
        }).save()
      })

      it('deletes relationship when user is admin of parent group', async () => {
        const result = await deletePeerRelationship(adminUser.id, peerRelationship.id)

        expect(result.success).to.be.true

        // Verify relationship is deactivated
        await peerRelationship.refresh()
        expect(peerRelationship.get('active')).to.be.false
      })

      it('deletes relationship when user is admin of child group', async () => {
        const result = await deletePeerRelationship(adminUser.id, peerRelationship.id)

        expect(result.success).to.be.true

        // Verify relationship is deactivated
        await peerRelationship.refresh()
        expect(peerRelationship.get('active')).to.be.false
      })

      it('rejects when user is not admin of either group', async () => {
        try {
          await deletePeerRelationship(memberUser.id, peerRelationship.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/You must be an administrator of one of the groups/)
        }
      })

      it('rejects when relationship does not exist', async () => {
        try {
          await deletePeerRelationship(adminUser.id, 99999)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Relationship not found/)
        }
      })

      it('rejects when trying to delete non-peer relationship', async () => {
        // Create a parent-child relationship
        const parentChildRelationship = await GroupRelationship.forge({
          parent_group_id: fromGroup.id,
          child_group_id: otherGroup.id,
          relationship_type: Group.RelationshipType.PARENT_CHILD,
          active: true
        }).save()

        try {
          await deletePeerRelationship(adminUser.id, parentChildRelationship.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Can only delete peer-to-peer relationships/)
        }

        // Clean up
        await parentChildRelationship.destroy()
      })

      it('rejects when relationship is already inactive', async () => {
        // Deactivate the relationship first
        await peerRelationship.save({ active: false })

        try {
          await deletePeerRelationship(adminUser.id, peerRelationship.id)
          expect.fail('should have thrown an error')
        } catch (error) {
          expect(error.message).to.match(/Relationship not found/)
        }
      })
    })
  })

  describe('permission checks for non-admins', () => {
    let steward, outsider, fromGroup, toGroup, invite

    before(async () => {
      steward = await factories.user().save()
      outsider = await factories.user().save()
      fromGroup = await factories.group().save()
      toGroup = await factories.group().save()
      await steward.joinGroup(fromGroup, { assignAdministrator: true })
      await steward.joinGroup(toGroup, { assignAdministrator: true })
      await outsider.joinGroup(fromGroup)
      await outsider.joinGroup(toGroup)
      invite = await GroupRelationshipInvite.create({
        userId: steward.id,
        fromGroupId: fromGroup.id,
        toGroupId: toGroup.id,
        type: GroupRelationshipInvite.TYPE.ParentToChild
      })
    })

    after(() => bookshelf.knex('groups_suggested_skills').where('group_id', fromGroup.id).del())

    it('does not let a non-admin accept, reject or cancel a group relationship invite', async () => {
      for (const fn of [acceptGroupRelationshipInvite, rejectGroupRelationshipInvite, cancelGroupRelationshipInvite]) {
        await expect(fn(outsider.id, invite.id)).to.be.rejectedWith(/permission/)
      }
      await invite.refresh()
      expect(invite.get('status')).to.equal(GroupRelationshipInvite.STATUS.Pending)
    })

    it('does not let a non-admin add or remove suggested skills', async () => {
      await expect(addSuggestedSkillToGroup(outsider.id, fromGroup.id, 'gardening')).to.be.rejectedWith(/permission/)
      await expect(removeSuggestedSkillFromGroup(outsider.id, fromGroup.id, 'gardening')).to.be.rejectedWith(/permission/)
    })

    it('still lets an admin add suggested skills', async () => {
      const skill = await addSuggestedSkillToGroup(steward.id, fromGroup.id, 'beekeeping')
      expect(skill.get('name')).to.equal('beekeeping')
    })
  })

  describe('invite policy', () => {
    let administrator, host, member

    const uniqueSlug = prefix => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    before(async () => {
      administrator = await factories.user().save()
      host = await factories.user().save()
      member = await factories.user().save()
    })

    describe('createGroup', () => {
      it('applies each mode inside the create', async () => {
        const everyone = await createGroup(administrator.id, { name: 'Everyone Invites', slug: uniqueSlug('everyone'), invitePolicy: { mode: 'everyone' } })
        expect(await GroupRole.getInvitePolicy(everyone.id)).to.deep.equal({ mode: 'everyone', roleIds: [] })

        // Moderators are stewards, so choosing only them is the same as stewards
        const roles = await createGroup(administrator.id, { name: 'Moderators Invite', slug: uniqueSlug('roles'), invitePolicy: { mode: 'roles', systemRoleNames: ['Moderator'] } })
        expect(await GroupRole.getInvitePolicy(roles.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })

        const stewards = await createGroup(administrator.id, { name: 'Stewards Invite', slug: uniqueSlug('stewards'), invitePolicy: { mode: 'stewards' } })
        expect(await GroupRole.getInvitePolicy(stewards.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      })

      it('creates no group when the policy is invalid', async () => {
        for (const invitePolicy of [{ mode: 'anyone' }, { mode: 'roles', systemRoleNames: ['Member'] }, { mode: 'roles', roleIds: ['1'] }]) {
          const slug = uniqueSlug('invalid-policy')
          await expect(createGroup(administrator.id, { name: 'Invalid Policy', slug, invitePolicy })).to.be.rejected
          expect(await Group.find(slug)).to.not.exist
        }
      })

      it('creates no group with an everyone or roles policy while member invitations are switched off', async () => {
        await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
          for (const invitePolicy of [{ mode: 'everyone' }, { mode: 'roles', systemRoleNames: ['Moderator'] }]) {
            const slug = uniqueSlug('switched-off')
            await expect(createGroup(administrator.id, { name: 'Switched Off', slug, invitePolicy }))
              .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
            expect(await Group.find(slug)).to.not.exist
          }

          const stewards = await createGroup(administrator.id, { name: 'Switched Off Stewards', slug: uniqueSlug('switched-off'), invitePolicy: { mode: 'stewards' } })
          expect(await GroupRole.getInvitePolicy(stewards.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
        })
      })

      it('defaults to everyone while member invitations are on, and to stewards while they are off', async () => {
        await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
          const created = await createGroup(administrator.id, { name: 'Default Policy', slug: uniqueSlug('default') })
          expect(await GroupRole.getInvitePolicy(created.id)).to.deep.equal({ mode: 'everyone', roleIds: [] })
        })

        await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
          const created = await createGroup(administrator.id, { name: 'Default Policy Off', slug: uniqueSlug('default-off') })
          expect(await GroupRole.getInvitePolicy(created.id)).to.deep.equal({ mode: GroupRole.DEFAULT_NEW_GROUP_INVITE_POLICY.mode, roleIds: [] })
          expect(GroupRole.DEFAULT_NEW_GROUP_INVITE_POLICY.mode).to.equal('stewards')
        })
      })

      it('keeps Protected visibility and Restricted joining for callers that send neither', async () => {
        const created = await createGroup(administrator.id, { name: 'Server Defaults', slug: uniqueSlug('server-defaults') })
        expect(created.get('visibility')).to.equal(Group.Visibility.PROTECTED)
        expect(created.get('accessibility')).to.equal(Group.Accessibility.RESTRICTED)
      })
    })

    describe('updateGroup', () => {
      let group, moderatorRole, greeterRole

      before(async () => {
        group = await factories.group().save()
        await administrator.joinGroup(group, { assignAdministrator: true })
        await host.joinGroup(group)
        await member.joinGroup(group)
        const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
        await MemberGroupRole.forge({ user_id: host.id, group_id: group.id, group_role_id: hostRole.id, active: true }).save()
        moderatorRole = await GroupRole.findSystemRole(group.id, 'Moderator')
        greeterRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '🙌', type: GroupRole.TYPE_CUSTOM, active: true }).save()
      })

      afterEach(() => GroupRole.setInvitePolicy(group.id, { mode: 'stewards' }))

      it('lets an Administrator set each mode', async () => {
        await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'everyone' } })
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'everyone', roleIds: [] })

        await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'roles', roleIds: [String(greeterRole.id)] } })
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'roles', roleIds: [moderatorRole.id, greeterRole.id] })

        await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'stewards' } })
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      })

      it('rejects a Host', async () => {
        expect(await GroupMembership.inviteAccess(host.id, group.id)).to.equal('full')
        await expect(updateGroup(host.id, group.id, { invitePolicy: { mode: 'everyone' } }))
          .to.be.rejectedWith("You don't have the right responsibilities for this group")
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      })

      it('saves none of the other changes when the policy is invalid', async () => {
        const name = group.get('name')
        const memberRole = await GroupRole.findMemberRole(group.id)
        await expect(updateGroup(administrator.id, group.id, { name: 'Renamed', invitePolicy: { mode: 'roles', roleIds: [memberRole.id] } }))
          .to.be.rejectedWith('Invite policy roles must be active roles in this group')

        const stored = await Group.find(group.id)
        expect(stored.get('name')).to.equal(name)
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
      })

      it('only lets an Administrator set stewards while member invitations are switched off', async () => {
        const name = group.get('name')
        await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
          for (const invitePolicy of [{ mode: 'everyone' }, { mode: 'roles', roleIds: [String(moderatorRole.id)] }]) {
            await expect(updateGroup(administrator.id, group.id, { name: 'Renamed', invitePolicy }))
              .to.be.rejectedWith(GroupRole.MEMBER_INVITES_UNAVAILABLE_ERROR)
          }
          expect((await Group.find(group.id)).get('name')).to.equal(name)
          expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })

          await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'stewards' } })
          expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'stewards', roleIds: [] })
        })
      })

      it('leaves the policy alone when none is given', async () => {
        await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
        await updateGroup(administrator.id, group.id, { description: 'Still everyone' })
        expect(await GroupRole.getInvitePolicy(group.id)).to.deep.equal({ mode: 'everyone', roleIds: [] })
      })

      describe('tightening it', () => {
        let moderator
        const pendingFrom = async sender => (await Invitation.where({ group_id: group.id, invited_by_id: sender.id }).fetchAll())
          .models.filter(invitation => !invitation.isExpired() && !invitation.isUsed()).length
        const invite = (sender, suffix) => Invitation.create({
          userId: sender.id,
          groupId: group.id,
          email: `tighten-${suffix}-${Date.now()}@example.com`,
          inviterAccess: Invitation.InviterAccess.LIMITED
        })

        before(async () => {
          moderator = await factories.user().save()
          await moderator.joinGroup(group)
          await MemberGroupRole.forge({ user_id: moderator.id, group_id: group.id, group_role_id: moderatorRole.id, active: true }).save()
        })

        it('expires the pending invitations of members who can no longer invite, and keeps the rest', async () => {
          await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
          await invite(member, 'member')
          await invite(moderator, 'moderator')
          const fullInvite = await Invitation.create({ userId: administrator.id, groupId: group.id, email: `tighten-admin-${Date.now()}@example.com` })

          await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'stewards' } })

          expect(await pendingFrom(member)).to.equal(0)
          expect(await pendingFrom(moderator)).to.equal(1)
          await fullInvite.refresh()
          expect(fullInvite.isExpired()).to.be.false
        })

        it('expires the invitations of a role taken out of specific roles', async () => {
          const greeter = await factories.user().save()
          await greeter.joinGroup(group)
          await MemberGroupRole.forge({ user_id: greeter.id, group_id: group.id, group_role_id: greeterRole.id, active: true }).save()
          const keeperRole = await GroupRole.forge({ group_id: group.id, name: 'Keeper', emoji: '🗝️', type: GroupRole.TYPE_CUSTOM, active: true }).save()
          const keeper = await factories.user().save()
          await keeper.joinGroup(group)
          await MemberGroupRole.forge({ user_id: keeper.id, group_id: group.id, group_role_id: keeperRole.id, active: true }).save()

          await GroupRole.setInvitePolicy(group.id, { mode: 'roles', roleIds: [greeterRole.id, keeperRole.id] })
          await invite(greeter, 'greeter')
          await invite(keeper, 'keeper')

          await updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'roles', roleIds: [String(keeperRole.id)] } })

          expect(await pendingFrom(greeter)).to.equal(0)
          expect(await pendingFrom(keeper)).to.equal(1)
        })

        it('expires nothing while member invitations are switched off', async () => {
          await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
          const straggler = await factories.user().save()
          await straggler.joinGroup(group)
          await invite(straggler, 'straggler')

          await withFeatureFlag('MEMBER_INVITES', 'off', () =>
            updateGroup(administrator.id, group.id, { invitePolicy: { mode: 'stewards' } }))

          expect(await pendingFrom(straggler)).to.equal(1)
        })
      })

      it('does not let limited access regenerate the join link', async () => {
        await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
        expect(await GroupMembership.inviteAccess(member.id, group.id)).to.equal('limited')

        const code = (await Group.find(group.id)).get('access_code')
        await expect(regenerateAccessCode(member.id, group.id))
          .to.be.rejectedWith("You don't have the right responsibilities for this group")
        expect((await Group.find(group.id)).get('access_code')).to.equal(code)
      })
    })
  })
})
