/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignCoordinator } from '../../../test/setup/roleHelpers'
import { archiveSpace, convertGroupToSpace, convertSpaceToChildGroup, createSpace, deleteSpace, joinSpace, updateSpace } from './spaces'

describe('space mutations', () => {
  let coordinator, member, parentGroup

  before(async () => {
    coordinator = await factories.user().save()
    member = await factories.user().save()
    parentGroup = await factories.group().save()
    await assignCoordinator(coordinator, parentGroup)
    await member.joinGroup(parentGroup)
  })

  after(async () => setup.clearDb())

  describe('createSpace slug', () => {
    it('stores {parentSlug}-{localSlug} to avoid collisions across groups', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General Chat',
        slug: 'general'
      }, {})

      expect(space.get('slug')).to.equal(`${parentGroup.get('slug')}-general`)
      await deleteSpace(coordinator.id, space.id, {})
    })

    it('prefixes a slug derived from the name when none is provided', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'My Space'
      }, {})

      expect(space.get('slug')).to.equal(`${parentGroup.get('slug')}-my-space`)
      await deleteSpace(coordinator.id, space.id, {})
    })

    it('does not double-prefix an already stored slug', async () => {
      const parentSlug = parentGroup.get('slug')
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'Already Prefixed',
        slug: `${parentSlug}-already`
      }, {})

      expect(space.get('slug')).to.equal(`${parentSlug}-already`)
      await deleteSpace(coordinator.id, space.id, {})
    })

    it('allows the same local slug under two parent groups', async () => {
      const localSlug = `shared-${Date.now()}`
      const otherParent = await factories.group().save()
      await assignCoordinator(coordinator, otherParent)

      const first = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General',
        slug: localSlug
      }, {})
      const second = await createSpace(coordinator.id, {
        parentGroupId: otherParent.id,
        name: 'General',
        slug: localSlug
      }, {})

      expect(first.get('slug')).to.equal(`${parentGroup.get('slug')}-${localSlug}`)
      expect(second.get('slug')).to.equal(`${otherParent.get('slug')}-${localSlug}`)
      await deleteSpace(coordinator.id, first.id, {})
      await deleteSpace(coordinator.id, second.id, {})
    })

    it('suffixes when the prefixed slug is already taken in the same group', async () => {
      const localSlug = `dup-${Date.now()}`
      const first = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General A',
        slug: localSlug
      }, {})
      const second = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General B',
        slug: localSlug
      }, {})

      expect(first.get('slug')).to.equal(`${parentGroup.get('slug')}-${localSlug}`)
      expect(second.get('slug')).to.equal(`${parentGroup.get('slug')}-${localSlug}-2`)
      await deleteSpace(coordinator.id, first.id, {})
      await deleteSpace(coordinator.id, second.id, {})
    })
  })

  describe('updateSpace name', () => {
    it('writes the new name onto the parent menu space view', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Orchard ${Date.now()}`
      }, {})
      const createdView = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(createdView.get('name')).to.equal(space.get('name'))

      await updateSpace(coordinator.id, { id: space.id, name: 'Plots' }, {})
      const updated = await Group.find(space.id)
      expect(updated.get('name')).to.equal('Plots')
      const updatedView = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(updatedView.get('name')).to.equal('Plots')
      await deleteSpace(coordinator.id, space.id, {})
    })
  })

  describe('updateSpace slug', () => {
    it('prefixes a local slug and is a no-op when the stored slug already matches', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'Garden',
        slug: 'garden'
      }, {})
      const stored = `${parentGroup.get('slug')}-garden`
      expect(space.get('slug')).to.equal(stored)

      const unchanged = await updateSpace(coordinator.id, { id: space.id, slug: 'garden' }, {})
      expect(unchanged.get('slug')).to.equal(stored)

      const updated = await updateSpace(coordinator.id, { id: space.id, slug: 'plots' }, {})
      expect(updated.get('slug')).to.equal(`${parentGroup.get('slug')}-plots`)
      await deleteSpace(coordinator.id, space.id, {})
    })
  })

  describe('deleteSpace', () => {
    it('soft-deletes the space (active = false)', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Delete Me ${Date.now()}`
      }, {})

      const result = await deleteSpace(coordinator.id, space.id, {})
      expect(result.success).to.be.true

      const found = await Group.find(space.id)
      expect(found).to.not.be.null
      expect(found.get('active')).to.equal(false)

      const menuEntry = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(menuEntry).to.be.null
    })

    it('soft-deletes an already archived space', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Archived Then Deleted ${Date.now()}`
      }, {})

      await archiveSpace(coordinator.id, space.id, {})
      const archived = await Group.find(space.id)
      expect(archived.get('status')).to.equal(Group.Status.ARCHIVED)
      expect(archived.get('active')).to.equal(true)

      const result = await deleteSpace(coordinator.id, space.id, {})
      expect(result.success).to.be.true
      const deleted = await Group.find(space.id)
      expect(deleted.get('active')).to.equal(false)
    })

    it('soft-deletes a funding round space without destroying the round', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Round Space ${Date.now()}`
      }, {})
      const round = await FundingRound.forge({
        group_id: space.id,
        title: 'Round Space',
        voting_method: 'quadratic',
        created_at: new Date(),
        updated_at: new Date()
      }).save()
      await space.save({ funding_round_id: round.id }, { patch: true })

      const result = await deleteSpace(coordinator.id, space.id, {})
      expect(result.success).to.be.true
      const deleted = await Group.find(space.id)
      expect(deleted.get('active')).to.equal(false)
      expect(await FundingRound.where({ id: round.id }).fetch()).to.not.be.null
    })

    it('rejects when user cannot manage spaces', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Protected ${Date.now()}`
      }, {})

      try {
        await deleteSpace(member.id, space.id, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/don.t have permission/)
      }

      expect(await Group.find(space.id)).to.not.be.null
      await deleteSpace(coordinator.id, space.id, {})
    })
  })

  describe('createSpace status', () => {
    it('creates published by default and on the menu', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Published ${Date.now()}`
      }, {})
      expect(space.get('status')).to.equal(Group.Status.PUBLISHED)
      const menuEntry = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(menuEntry.get('order')).to.not.equal(null)
      expect(menuEntry.get('name')).to.equal(space.get('name'))
    })

    it('creates drafts off-menu', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Draft ${Date.now()}`,
        status: Group.Status.DRAFT,
        addToMenu: true
      }, {})
      expect(space.get('status')).to.equal(Group.Status.DRAFT)
      const menuEntry = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(menuEntry.get('order')).to.equal(null)
    })
  })

  describe('archiveSpace', () => {
    it('sets status archived and keeps the row active', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Archive Me ${Date.now()}`
      }, {})

      await archiveSpace(coordinator.id, space.id, {})
      const archived = await Group.find(space.id)
      expect(archived.get('status')).to.equal(Group.Status.ARCHIVED)
      expect(archived.get('active')).to.equal(true)

      const menuEntry = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: space.id
      }).fetch()
      expect(menuEntry).to.be.null
    })
  })

  describe('convertSpaceToChildGroup', () => {
    it('turns an on-menu space into a child group and converts the menu item', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `On Menu Convert ${Date.now()}`
      }, {})

      const converted = await convertSpaceToChildGroup(coordinator.id, space.id, {})
      expect(converted.get('type')).to.equal(null)
      expect(converted.get('parent_id')).to.equal(null)

      const relationship = await GroupRelationship.forPair(parentGroup.id, space.id).fetch()
      expect(relationship).to.not.be.null
      expect(relationship.get('active')).to.equal(true)

      const menuEntry = await GroupView.where({ linked_group_id: space.id }).fetch()
      expect(menuEntry.get('type')).to.equal(GroupView.Type.GROUP)
      expect(menuEntry.get('order')).to.not.equal(null)
    })

    it('sets visibility to protected and keeps accessibility', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Open Convert ${Date.now()}`,
        visibility: Group.Visibility.PUBLIC,
        accessibility: Group.Accessibility.OPEN
      }, {})

      const converted = await convertSpaceToChildGroup(coordinator.id, space.id, {})
      expect(converted.get('visibility')).to.equal(Group.Visibility.PROTECTED)
      expect(converted.get('accessibility')).to.equal(Group.Accessibility.OPEN)
    })

    it('sets role-gated spaces to hidden and closed', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Role Gated Convert ${Date.now()}`,
        visibility: Group.Visibility.HIDDEN,
        accessibility: Group.Accessibility.CLOSED,
        requiredRoles: [1]
      }, {})

      const converted = await convertSpaceToChildGroup(coordinator.id, space.id, {})
      expect(converted.get('visibility')).to.equal(Group.Visibility.HIDDEN)
      expect(converted.get('accessibility')).to.equal(Group.Accessibility.CLOSED)
      expect(converted.get('required_roles')).to.equal(null)
    })

    it('deletes an off-menu space view so the group only appears as a related group', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Off Menu Convert ${Date.now()}`,
        addToMenu: false
      }, {})

      await convertSpaceToChildGroup(coordinator.id, space.id, {})

      const menuEntry = await GroupView.where({ linked_group_id: space.id }).fetch()
      expect(menuEntry).to.be.null

      const relationship = await GroupRelationship.forPair(parentGroup.id, space.id).fetch()
      expect(relationship).to.not.be.null
    })

    it('copies parent steward roles onto the new child group', async () => {
      const host = await factories.user().save()
      await host.joinGroup(parentGroup)
      await GroupRole.setupSystemRoles(parentGroup.id)
      const moderatorRole = await GroupRole.findSystemRole(parentGroup.id, 'Moderator')
      const hostRole = await GroupRole.findSystemRole(parentGroup.id, 'Host')
      await MemberGroupRole.forge({
        user_id: member.id,
        group_id: parentGroup.id,
        group_role_id: moderatorRole.id,
        active: true
      }).save()
      await MemberGroupRole.forge({
        user_id: host.id,
        group_id: parentGroup.id,
        group_role_id: hostRole.id,
        active: true
      }).save()

      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Steward Copy ${Date.now()}`
      }, {})

      const converted = await convertSpaceToChildGroup(coordinator.id, space.id, {})

      const childCoordinator = await GroupRole.findSystemRole(converted.id, 'Coordinator')
      const childModerator = await GroupRole.findSystemRole(converted.id, 'Moderator')
      const childHost = await GroupRole.findSystemRole(converted.id, 'Host')

      const converterMembership = await GroupMembership.forPair(coordinator.id, converted.id).fetch()
      const memberMembership = await GroupMembership.forPair(member.id, converted.id).fetch()
      const hostMembership = await GroupMembership.forPair(host.id, converted.id).fetch()
      expect(converterMembership).to.not.be.null
      expect(memberMembership).to.not.be.null
      expect(hostMembership).to.not.be.null
      expect(converterMembership.get('settings')?.showJoinForm).to.not.equal(true)
      expect(memberMembership.get('settings')?.showJoinForm).to.equal(false)
      expect(hostMembership.get('settings')?.showJoinForm).to.equal(false)

      expect(await MemberGroupRole.where({
        user_id: coordinator.id,
        group_id: converted.id,
        group_role_id: childCoordinator.id
      }).fetch()).to.not.be.null
      expect(await MemberGroupRole.where({
        user_id: member.id,
        group_id: converted.id,
        group_role_id: childModerator.id
      }).fetch()).to.not.be.null
      expect(await MemberGroupRole.where({
        user_id: host.id,
        group_id: converted.id,
        group_role_id: childHost.id
      }).fetch()).to.not.be.null
    })

    it('rejects track and funding round spaces', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Round Convert ${Date.now()}`
      }, {})
      const round = await FundingRound.forge({
        group_id: space.id,
        title: 'Round Convert',
        voting_method: 'quadratic',
        created_at: new Date(),
        updated_at: new Date()
      }).save()
      await space.save({ funding_round_id: round.id }, { patch: true })

      try {
        await convertSpaceToChildGroup(coordinator.id, space.id, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/Track and funding round/)
      }

      await deleteSpace(coordinator.id, space.id, {})
    })

    it('rejects when user cannot manage the space', async () => {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `No Perm Convert ${Date.now()}`
      }, {})

      try {
        await convertSpaceToChildGroup(member.id, space.id, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/don.t have permission/)
      }

      await deleteSpace(coordinator.id, space.id, {})
    })
  })

  describe('convertGroupToSpace', () => {
    async function createChildGroup () {
      const child = await factories.group().save()
      await assignCoordinator(coordinator, child)
      await parentGroup.addChild(child)
      return child
    }

    it('turns a parent menu group item into a space item', async () => {
      const child = await createChildGroup()
      await GroupView.appendToMenu({
        group_id: parentGroup.id,
        type: GroupView.Type.GROUP,
        linked_group_id: child.id,
        name: child.get('name')
      })

      const converted = await convertGroupToSpace(coordinator.id, {
        id: child.id,
        parentGroupId: parentGroup.id
      }, {})
      expect(converted.get('type')).to.equal('space')
      expect(String(converted.get('parent_id'))).to.equal(String(parentGroup.id))

      const relationship = await GroupRelationship.forPair(parentGroup.id, child.id).fetch()
      expect(relationship).to.be.null

      const menuEntry = await GroupView.where({
        group_id: parentGroup.id,
        linked_group_id: child.id
      }).fetch()
      expect(menuEntry.get('type')).to.equal(GroupView.Type.SPACE)
      expect(menuEntry.get('order')).to.not.equal(null)
    })

    it('creates an off-menu space view when the child has no parent menu item', async () => {
      const child = await createChildGroup()

      await convertGroupToSpace(coordinator.id, {
        id: child.id,
        parentGroupId: parentGroup.id
      }, {})

      const menuEntry = await GroupView.where({
        type: GroupView.Type.SPACE,
        linked_group_id: child.id
      }).fetch()
      expect(menuEntry).to.not.be.null
      expect(menuEntry.get('order')).to.equal(null)
    })

    it('rejects when the group has more than one parent', async () => {
      const child = await createChildGroup()
      const otherParent = await factories.group().save()
      await assignCoordinator(coordinator, otherParent)
      await otherParent.addChild(child)

      try {
        await convertGroupToSpace(coordinator.id, {
          id: child.id,
          parentGroupId: parentGroup.id
        }, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/exactly one parent/)
      }
    })

    it('rejects when user cannot administer both groups', async () => {
      const child = await createChildGroup()

      try {
        await convertGroupToSpace(member.id, {
          id: child.id,
          parentGroupId: parentGroup.id
        }, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/don.t have permission/)
      }
    })

    it('rejects when the group has a child group', async () => {
      const child = await createChildGroup()
      const grandchild = await factories.group().save()
      await child.addChild(grandchild)

      try {
        await convertGroupToSpace(coordinator.id, {
          id: child.id,
          parentGroupId: parentGroup.id
        }, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/child or peer groups/)
      }
    })

    it('rejects when the group has a peer group', async () => {
      const child = await createChildGroup()
      const peer = await factories.group().save()
      await GroupRelationship.forge({
        parent_group_id: child.id,
        child_group_id: peer.id,
        relationship_type: Group.RelationshipType.PEER_TO_PEER,
        active: true
      }).save()

      try {
        await convertGroupToSpace(coordinator.id, {
          id: child.id,
          parentGroupId: parentGroup.id
        }, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/child or peer groups/)
      }
    })

    it('rejects when the group has spaces of its own', async () => {
      const child = await createChildGroup()
      await assignCoordinator(coordinator, child)
      const space = await createSpace(coordinator.id, {
        parentGroupId: child.id,
        name: `Child Space ${Date.now()}`
      }, {})

      try {
        await convertGroupToSpace(coordinator.id, {
          id: child.id,
          parentGroupId: parentGroup.id
        }, {})
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/has spaces/)
      } finally {
        await deleteSpace(coordinator.id, space.id, {})
      }
    })
  })

  describe('joinSpace', () => {
    async function createAndLeaveSpace (attrs) {
      const space = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: `Join ${Date.now()}`,
        ...attrs
      }, {})
      await space.removeMembers([coordinator.id])
      return space
    }

    it('lets Administration join a restricted space without requesting', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.RESTRICTED })

      const membership = await joinSpace(coordinator.id, space.id)
      expect(membership).to.be.ok

      try {
        await joinSpace(member.id, space.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/request to join/)
      }
    })

    it('lets Administration join a closed space', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })

      const membership = await joinSpace(coordinator.id, space.id)
      expect(membership).to.be.ok

      try {
        await joinSpace(member.id, space.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/request to join/)
      }
    })

    it('returns the existing membership when the user is already in the space', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })
      const first = await joinSpace(member.id, space.id, space.get('access_code'))
      const second = await joinSpace(member.id, space.id, space.get('access_code'))
      expect(second.id).to.equal(first.id)
    })

    it('lets a parent member join a closed space with a valid access code', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })

      const membership = await joinSpace(member.id, space.id, space.get('access_code'))
      expect(membership).to.be.ok
    })

    it('rejects a closed-space join with an invalid access code', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })

      try {
        await joinSpace(member.id, space.id, 'not-a-real-code')
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/request to join/)
      }
    })

    it('rejects a closed-space join with another space access code', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })
      const other = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })

      try {
        await joinSpace(member.id, space.id, other.get('access_code'))
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/request to join/)
      }
    })

    it('lets a parent member join a closed space with an invitation token', async () => {
      const space = await createAndLeaveSpace({ accessibility: Group.Accessibility.CLOSED })
      const invitation = await Invitation.create({
        userId: coordinator.id,
        groupId: space.id,
        email: member.get('email')
      })

      const membership = await joinSpace(member.id, space.id, null, invitation.get('token'))
      expect(membership).to.be.ok
      await invitation.refresh()
      expect(invitation.get('used_by_id')).to.equal(member.id)
    })

    it('lets Administration join a role-gated space without the required role', async () => {
      const gatedRole = await GroupRole.forge({
        group_id: parentGroup.id,
        name: 'Gated',
        emoji: '🔑',
        type: GroupRole.TYPE_CUSTOM
      }).save()
      const space = await createAndLeaveSpace({
        accessibility: Group.Accessibility.OPEN,
        requiredRoles: [gatedRole.id]
      })

      const membership = await joinSpace(coordinator.id, space.id)
      expect(membership).to.be.ok

      try {
        await joinSpace(member.id, space.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/required role/)
      }
    })
  })
})
