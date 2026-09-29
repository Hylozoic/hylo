/* eslint-disable no-unused-expressions */
import { createRequestHandler } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'

const ME_HAS_ANY = `{
  me {
    hasTracks
    hasFundingRounds
    hasTransactions
    hasSavedSearches
  }
}`

describe('Me "has any" fields for the My Home menu', () => {
  let handler, parent

  async function queryAs (user) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId: user.id, destroy: () => {} }
    req.user = user
    const res = factories.mock.response()
    const { executionResult } = await handler.inject({ document: ME_HAS_ANY, serverContext: { req, res } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data.me
  }

  // knex returns [{ id }] or [id] depending on version
  async function insertId (query) {
    const [row] = await query.returning('id')
    return row?.id ?? row
  }

  // Created with its attributes: adding members saves the whole group record
  function spaceWith (attrs) {
    return factories.group({ type: 'space', parent_id: parent.id, ...attrs }).save()
  }

  before(async () => {
    handler = createRequestHandler()
    parent = await factories.group().save()
  })

  it('is all false for someone with nothing in those places', async () => {
    const user = await factories.user().save()
    await parent.addMembers([user.id])
    expect(await queryAs(user)).to.deep.equal({
      hasTracks: false,
      hasFundingRounds: false,
      hasTransactions: false,
      hasSavedSearches: false
    })
  })

  it('reports tracks and funding rounds the person belongs to', async () => {
    const user = await factories.user().save()
    const trackId = await insertId(bookshelf.knex('tracks').insert({ created_at: new Date() }))
    const trackSpace = await spaceWith({ track_id: trackId })
    await trackSpace.addMembers([user.id])

    let me = await queryAs(user)
    expect(me.hasTracks).to.be.true
    expect(me.hasFundingRounds).to.be.false

    const roundSpace = await spaceWith({})
    await roundSpace.addMembers([user.id])
    const roundId = await insertId(bookshelf.knex('funding_rounds')
      .insert({ group_id: roundSpace.id, voting_method: 'token_allocation_constant', created_at: new Date() }))
    await bookshelf.knex('groups').where({ id: roundSpace.id }).update({ funding_round_id: roundId })

    me = await queryAs(user)
    expect(me.hasFundingRounds).to.be.true
  })

  it('ignores spaces the person has left', async () => {
    const user = await factories.user().save()
    const trackId = await insertId(bookshelf.knex('tracks').insert({ created_at: new Date() }))
    const trackSpace = await spaceWith({ track_id: trackId })
    await trackSpace.addMembers([user.id])
    await bookshelf.knex('group_memberships').where({ group_id: trackSpace.id, user_id: user.id }).update({ active: false })

    expect((await queryAs(user)).hasTracks).to.be.false
  })

  it('reports purchases but not access a steward granted', async () => {
    const user = await factories.user().save()
    await bookshelf.knex('content_access').insert({
      user_id: user.id,
      granted_by_group_id: parent.id,
      group_id: parent.id,
      access_type: 'admin_grant'
    })
    expect((await queryAs(user)).hasTransactions).to.be.false

    await bookshelf.knex('content_access').insert({
      user_id: user.id,
      granted_by_group_id: parent.id,
      group_id: parent.id,
      access_type: 'stripe_purchase'
    })
    expect((await queryAs(user)).hasTransactions).to.be.true
  })

  it('reports active saved searches only', async () => {
    const user = await factories.user().save()
    await bookshelf.knex('saved_searches').insert({ user_id: user.id, context: 'all', is_active: false, created_at: new Date() })
    expect((await queryAs(user)).hasSavedSearches).to.be.false

    await bookshelf.knex('saved_searches').insert({ user_id: user.id, context: 'all', is_active: true, created_at: new Date() })
    expect((await queryAs(user)).hasSavedSearches).to.be.true
  })
})
