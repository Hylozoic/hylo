import '../../../test/setup'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createCollection,
  addPostToCollection,
  removePostFromCollection,
  reorderPostInCollection
} from './collection'

async function assignCoordinator (user, group) {
  await user.joinGroup(group)
  await new MemberCommonRole({
    user_id: user.id,
    group_id: group.id,
    common_role_id: CommonRole.ROLES.Coordinator
  }).save()
}

describe('collection mutations', () => {
  let owner, other, group, post

  before(async () => {
    owner = await factories.user().save()
    other = await factories.user().save()
    group = await factories.group().save()
    post = await factories.post({ user_id: owner.id }).save()
    await owner.joinGroup(group)
    await post.groups().attach(group)
  })

  after(async () => setup.clearDb())

  describe('createCollection', () => {
    it('returns null when there is no name or groupId', async () => {
      const col = await createCollection(owner.id, {})
      expect(col).to.equal(null)
    })

    it('creates a personal collection', async () => {
      const col = await createCollection(owner.id, { name: 'Reading list' })
      expect(col.get('name')).to.equal('Reading list')
      expect(col.get('user_id')).to.equal(owner.id)
    })

    it('creates a group collection', async () => {
      const col = await createCollection(owner.id, { name: 'Group picks', groupId: group.id })
      expect(col.get('group_id')).to.equal(group.id)
    })
  })

  describe('addPostToCollection', () => {
    it('adds a post when the user owns the collection', async () => {
      const col = await createCollection(owner.id, { name: 'Mine' })
      const result = await addPostToCollection(owner.id, col.id, post.id)
      expect(result.success).to.equal(true)
      const rows = await CollectionsPost.where({ collection_id: col.id, post_id: post.id }).fetch()
      expect(rows).to.exist
    })

    it('rejects a user who cannot access the collection', async () => {
      const col = await createCollection(owner.id, { name: 'Private' })
      try {
        await addPostToCollection(other.id, col.id, post.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/Not a valid collection/)
      }
    })

    it('throws when the post does not exist', async () => {
      const col = await createCollection(owner.id, { name: 'List' })
      try {
        await addPostToCollection(owner.id, col.id, 999999999)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/Not a valid post/)
      }
    })
  })

  describe('removePostFromCollection and reorderPostInCollection', () => {
    it('removes and reorders posts', async () => {
      const mod = await factories.user().save()
      const g = await factories.group().save()
      await assignCoordinator(mod, g)
      const p1 = await factories.post({ user_id: mod.id }).save()
      const p2 = await factories.post({ user_id: mod.id }).save()
      await p1.groups().attach(g)
      await p2.groups().attach(g)

      const col = await createCollection(mod.id, { name: 'Shared', groupId: g.id })
      await addPostToCollection(mod.id, col.id, p1.id)
      await addPostToCollection(mod.id, col.id, p2.id)

      const row2 = await CollectionsPost.where({ collection_id: col.id, post_id: p2.id }).fetch()
      const row1 = await CollectionsPost.where({ collection_id: col.id, post_id: p1.id }).fetch()
      expect(row1.get('order')).to.be.below(row2.get('order'))

      await reorderPostInCollection(mod.id, col.id, p2.id, 0)

      const row2After = await CollectionsPost.where({ collection_id: col.id, post_id: p2.id }).fetch()
      expect(row2After.get('order')).to.equal(0)

      await removePostFromCollection(mod.id, col.id, p1.id)
      const gone = await CollectionsPost.where({ collection_id: col.id, post_id: p1.id }).fetch()
      expect(gone).to.be.null
    })
  })
})
