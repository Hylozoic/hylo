/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignCoordinator } from '../../../test/setup/roleHelpers'
import { archiveSpace, createSpace, deleteSpace, joinSpace, updateSpace } from './spaces'

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
      const otherParent = await factories.group().save()
      await assignCoordinator(coordinator, otherParent)

      const first = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General',
        slug: 'general'
      }, {})
      const second = await createSpace(coordinator.id, {
        parentGroupId: otherParent.id,
        name: 'General',
        slug: 'general'
      }, {})

      expect(first.get('slug')).to.equal(`${parentGroup.get('slug')}-general`)
      expect(second.get('slug')).to.equal(`${otherParent.get('slug')}-general`)
      await deleteSpace(coordinator.id, first.id, {})
      await deleteSpace(coordinator.id, second.id, {})
    })

    it('suffixes when the prefixed slug is already taken in the same group', async () => {
      const first = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General A',
        slug: 'general'
      }, {})
      const second = await createSpace(coordinator.id, {
        parentGroupId: parentGroup.id,
        name: 'General B',
        slug: 'general'
      }, {})

      expect(first.get('slug')).to.equal(`${parentGroup.get('slug')}-general`)
      expect(second.get('slug')).to.equal(`${parentGroup.get('slug')}-general-2`)
      await deleteSpace(coordinator.id, first.id, {})
      await deleteSpace(coordinator.id, second.id, {})
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
