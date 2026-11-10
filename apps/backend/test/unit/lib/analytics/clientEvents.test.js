import { expect } from 'chai'
import { GraphQLError } from 'graphql'
import { cleanProperties, isAnonymousId, recordClientEvents } from '../../../../lib/analytics/clientEvents'

describe('client events', () => {
  it('accepts a generated anonymous id', () => {
    expect(isAnonymousId('abc12345')).to.equal(true)
    expect(isAnonymousId('short')).to.equal(false)
    expect(isAnonymousId('has space!')).to.equal(false)
  })

  it('drops nested and oversized properties', () => {
    const clean = cleanProperties({ step: 'explore', groupId: 12, extra: { no: true }, note: 'x'.repeat(500) })
    expect(clean.step).to.equal('explore')
    expect(clean.groupId).to.equal(12)
    expect(clean.extra).to.equal(undefined)
    expect(clean.note).to.have.length(200)
  })

  it('rejects event names that are not on the list', async () => {
    let inserted = null
    const knex = table => ({
      insert: rows => {
        inserted = { table, rows }
        return Promise.resolve()
      }
    })
    const recorded = await recordClientEvents(knex, {
      userId: 4,
      events: [{ name: 'Post Created' }, { name: 'Post Opened', properties: { postId: 9 } }]
    })
    expect(recorded).to.equal(1)
    expect(inserted.table).to.equal('activity_events')
    expect(inserted.rows[0].event_type).to.equal('post_opened')
    expect(inserted.rows[0].user_id).to.equal(4)
  })

  it('stores logged-out events separately', async () => {
    let tableName = null
    const knex = table => ({
      insert: () => {
        tableName = table
        return Promise.resolve()
      }
    })
    await recordClientEvents(knex, { anonymousId: 'device-1234', events: [{ name: 'Login Wall Hit' }] })
    expect(tableName).to.equal('anonymous_events')
  })

  it('requires an anonymous id when nobody is logged in', async () => {
    try {
      await recordClientEvents(() => {}, { events: [{ name: 'Post Opened' }] })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).to.be.instanceOf(GraphQLError)
    }
  })
})
