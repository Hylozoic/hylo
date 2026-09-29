/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20261001000100_posts_chat_created_at_index')

async function indexDefinition () {
  const row = await bookshelf.knex('pg_indexes')
    .where({ tablename: 'posts', indexname: 'posts_chat_created_at_index' })
    .first('indexdef')
  return row ? row.indexdef : null
}

// The index is built CONCURRENTLY, which cannot run inside a transaction, so this runs
// against the test database directly and leaves the index as schema.sql has it.
describe('migration 20261001000100_posts_chat_created_at_index', () => {
  before(() => setup.clearDb())

  it('runs outside a transaction', () => {
    expect(migration.config).to.deep.equal({ transaction: false })
  })

  it('matches schema.sql, reverses cleanly and can re-run', async () => {
    const fromSchema = await indexDefinition()
    expect(fromSchema).to.match(/ON public\.posts USING btree \(created_at\) WHERE \(\(type\)::text = 'chat'::text\)/)

    await migration.down(bookshelf.knex)
    expect(await indexDefinition()).to.equal(null)

    await migration.up(bookshelf.knex)
    expect(await indexDefinition()).to.equal(fromSchema)

    await migration.up(bookshelf.knex)
    expect(await indexDefinition()).to.equal(fromSchema)
  })
})
