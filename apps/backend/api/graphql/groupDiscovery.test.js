/* eslint-disable no-unused-expressions */
import setup from '../../test/setup'
import factories from '../../test/setup/factories'
import { createRequestHandler } from './index'

const HIDDEN = 0
const PUBLIC = 2

// Runs a document through the real schema, as the given user
async function run (handler, userId, document) {
  const { executionResult } = await handler.inject({
    document,
    serverContext: { req: { session: { userId } } }
  })
  return executionResult
}

describe('group discovery through GraphQL', () => {
  let handler, viewer, admin, oldAdmins

  before(async () => {
    await setup.clearDb()
    handler = createRequestHandler()
    viewer = await factories.user().save()
    admin = await factories.user().save()
    oldAdmins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = String(admin.id)
    for (let i = 0; i < 5; i++) {
      await factories.group({ name: `Quince Orchard ${i}`, visibility: PUBLIC, allow_in_public: true }).save()
    }
    await factories.group({ name: 'Quince Orchard Unlisted', visibility: PUBLIC, allow_in_public: false }).save()
    await factories.group({ name: 'Quince Orchard Hidden', visibility: HIDDEN }).save()
  })

  after(() => {
    process.env.HYLO_ADMINS = oldAdmins
  })

  describe('searchGroups', () => {
    it('returns the total and whether there are more, when more groups match than were asked for', async () => {
      const result = await run(handler, viewer.id, '{ searchGroups(term: "quince", first: 2) { total hasMore items { id name } } }')
      expect(result.errors).to.be.undefined
      expect(result.data.searchGroups.total).to.equal(5)
      expect(result.data.searchGroups.hasMore).to.be.true
      expect(result.data.searchGroups.items).to.have.length(2)
    })

    it('reports no more groups on the last page', async () => {
      const result = await run(handler, viewer.id, '{ searchGroups(term: "quince", first: 2, offset: 4) { total hasMore items { id } } }')
      expect(result.errors).to.be.undefined
      expect(result.data.searchGroups.total).to.equal(5)
      expect(result.data.searchGroups.hasMore).to.be.false
      expect(result.data.searchGroups.items).to.have.length(1)
    })

    it('leaves out unlisted and hidden groups the viewer is not connected to', async () => {
      const result = await run(handler, viewer.id, '{ searchGroups(term: "quince", first: 20) { items { name } } }')
      const names = result.data.searchGroups.items.map(g => g.name)
      expect(names).not.to.include('Quince Orchard Unlisted')
      expect(names).not.to.include('Quince Orchard Hidden')
    })

    it('caps how many groups one request can ask for', async () => {
      const result = await run(handler, viewer.id, '{ searchGroups(term: "quince", first: 100000) { total hasMore items { id } } }')
      expect(result.errors).to.be.undefined
      expect(result.data.searchGroups.total).to.equal(5)
      expect(result.data.searchGroups.hasMore).to.be.false
    })

    it('returns nothing for a term shorter than two characters', async () => {
      const result = await run(handler, viewer.id, '{ searchGroups(term: "q") { total hasMore items { id } } }')
      expect(result.errors).to.be.undefined
      expect(result.data.searchGroups).to.deep.equal({ total: 0, hasMore: false, items: [] })
    })
  })
})
