import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createSavedSearch, deleteSavedSearch } from './savedSearch'

describe('createSavedSearch', () => {
  let user, otherUser

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    otherUser = await factories.user().save()
  })

  after(async () => {
    await SavedSearch.query().del()
    await setup.clearDb()
  })

  it('always attributes the search to the authenticated user', async () => {
    await factories.post().save()

    const search = await createSavedSearch(user.id, {
      boundingBox: [
        { lng: -122.5, lat: 37.7 },
        { lng: -122.3, lat: 37.9 }
      ],
      context: 'all',
      name: 'My search',
      postTypes: ['discussion'],
      searchText: 'test',
      topicIds: [],
      userId: otherUser.id
    })

    expect(String(search.get('user_id'))).to.equal(String(user.id))
  })
})

describe('deleteSavedSearch', () => {
  let owner, attacker, savedSearch

  before(async () => {
    await setup.clearDb()
    owner = await factories.user().save()
    attacker = await factories.user().save()
    savedSearch = await SavedSearch.forge({
      user_id: owner.id,
      name: 'Owner search',
      context: 'all',
      is_active: true,
      created_at: new Date()
    }).save()
  })

  after(async () => {
    await SavedSearch.query().del()
    await setup.clearDb()
  })

  it('allows the owner to delete their saved search', async () => {
    const deletedId = await deleteSavedSearch(owner.id, savedSearch.id)
    expect(deletedId).to.equal(savedSearch.id)

    const updated = await SavedSearch.where({ id: savedSearch.id }).fetch()
    expect(updated.get('is_active')).to.equal(false)
  })

  it('rejects deletion by another user', async () => {
    const otherSearch = await SavedSearch.forge({
      user_id: owner.id,
      name: 'Another owner search',
      context: 'all',
      is_active: true,
      created_at: new Date()
    }).save()

    try {
      await deleteSavedSearch(attacker.id, otherSearch.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/don't have permission/)
    }

    const unchanged = await SavedSearch.where({ id: otherSearch.id }).fetch()
    expect(unchanged.get('is_active')).to.equal(true)
  })

  it('rejects when saved search does not exist', async () => {
    try {
      await deleteSavedSearch(owner.id, 999999999)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Saved search not found/)
    }
  })
})
