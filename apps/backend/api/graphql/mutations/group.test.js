/* eslint-disable no-unused-expressions */
import factories from '../../../test/setup/factories'

import {
  createGroup,
  updateGroup,
  addModerator,
  removeModerator,
  removeMember,
  regenerateAccessCode,
  deleteGroupTopic,
  deleteGroup,
  invitePeerRelationship,
  updatePeerRelationship,
  deletePeerRelationship
} from './group'

let starterGroup, starterPost

before(async () => {
  starterGroup = await factories.group().save({ slug: 'starter-posts', access_code: 'aasdfkjh3##Sasdfsdfedss', accessibility: Group.Accessibility.OPEN })
  starterPost = await factories.post().save()
  await starterGroup.posts().attach(starterPost.id)
})

describe('mutations/group', () => {
  describe('moderation', () => {
    let user, group

    before(function () {
      user = factories.user()
      group = factories.group()
      return Promise.join(group.save(), user.save())
        .then(() => user.joinGroup(group, { role: GroupMembership.Role.MODERATOR }))
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

    describe('addModerator', () => {
      it('works for a non-member', async () => {
        const user2 = await factories.user().save()
        await addModerator(user.id, user2.id, group.id)
        expect(await GroupMembership.hasResponsibility(user2, group, Responsibility.constants.RESP_ADMINISTRATION))
      })

      it('works for an existing member', async () => {
        const user2 = await factories.user().save()
        await user2.joinGroup(group)
        await addModerator(user.id, user2.id, group.id)
        expect(await GroupMembership.hasResponsibility(user2, group, Responsibility.constants.RESP_ADMINISTRATION))
      })
    })

    // TODO: remove?
    describe('removeModerator', () => {
      it('just removes moderator role', async () => {
        const user2 = await factories.user().save()
        await user2.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
        await removeModerator(user.id, user2.id, group.id)
        expect(!await GroupMembership.hasResponsibility(user2, group, Responsibility.constants.RESP_ADMINISTRATION))

        const membership = await GroupMembership.forPair(user2, group,
          { includeInactive: true }).fetch()
        expect(membership.get('active')).to.be.true
      })

      it('also removes from group when selected', async () => {
        const user2 = await factories.user().save()
        await user2.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
        await removeModerator(user.id, user2.id, group.id, true)
        expect(!await GroupMembership.hasResponsibility(user2, group, Responsibility.constants.RESP_ADMINISTRATION))

        const membership = await GroupMembership.forPair(user2, group,
          { includeInactive: true }).fetch()
        expect(membership.get('active')).to.be.false
      })

      it('throws an error if youre not an administrator', async () => {
        const nonModeratorUser = await factories.user().save()
        await nonModeratorUser.joinGroup(group, { role: GroupMembership.Role.DEFAULT })

        const user2 = await factories.user().save()
        await user2.joinGroup(group, { role: GroupMembership.Role.MODERATOR })

        return expect(removeModerator(nonModeratorUser.id, user2.id, group.id, true)).to.eventually.be.rejected
      })
    })

    describe('removeMember', () => {
      it('works', async () => {
        const user2 = await factories.user().save()
        await user2.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
        await removeMember(user.id, user2.id, group.id)

        const membership = await GroupMembership.forPair(user2, group,
          { includeInactive: true }).fetch()
        expect(membership.get('active')).to.be.false
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

  describe('createGroup', () => {
    let user

    before(async () => {
      starterGroup = await factories.group().save({ slug: 'starter-posts', access_code: 'aasdfkjh3##Sasdfsdfedss', accessibility: Group.Accessibility.OPEN })
      starterPost = await factories.post().save()
      await starterGroup.posts().attach(starterPost.id)
      user = await factories.user().save()
      starterGroup.addMembers([user])
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
      const hasModeratorRole = await membership.hasRole(GroupMembership.Role.MODERATOR)
      expect(hasModeratorRole).to.be.true

      const generalTopic = await group.tags().fetchOne()
      expect(generalTopic).to.exist
      expect(generalTopic.get('name')).to.equal('general')
      expect(generalTopic.pivot.get('is_default')).to.equal(true)

      const user2 = await membership.user().fetch()
      const generalTagFollow = await user2.tagFollows().fetchOne()
      expect(generalTagFollow).to.exist
      expect(generalTagFollow.get('tag_id')).to.equal(generalTopic.id)
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
        .then(() => user.joinGroup(group, { role: GroupMembership.Role.MODERATOR }))
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
      await user.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
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
      await GroupRelationship.where('id', '>', 0).destroy()
      await GroupRelationshipInvite.where('id', '>', 0).destroy()

      adminUser = await factories.user().save()
      memberUser = await factories.user().save()
      fromGroup = await factories.group().save()
      toGroup = await factories.group().save()
      otherGroup = await factories.group().save()

      // Make adminUser an administrator of both fromGroup and toGroup
      await adminUser.joinGroup(fromGroup, { role: GroupMembership.Role.MODERATOR })
      await adminUser.joinGroup(toGroup, { role: GroupMembership.Role.MODERATOR })

      // Make memberUser a regular member of fromGroup only
      await memberUser.joinGroup(fromGroup, { role: GroupMembership.Role.DEFAULT })
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
        expect(result.groupRelationshipInvite.id).to.equal(existingInvite.id)

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
})
