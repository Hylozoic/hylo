/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20261011000100_digest_dedupe_indexes')

async function indexDefinitions () {
  const rows = await bookshelf.knex('pg_indexes')
    .whereIn('indexname', ['activities_post_id_reader_id_index', 'notifications_activity_id_email_index'])
    .orderBy('indexname')
    .select('indexname', 'indexdef')
  return Object.fromEntries(rows.map(row => [row.indexname, row.indexdef]))
}

// The indexes are built CONCURRENTLY, which cannot run inside a transaction, so this runs
// against the test database directly and leaves the indexes as schema.sql has them.
describe('migration 20261011000100_digest_dedupe_indexes', () => {
  before(() => setup.clearDb())

  it('runs outside a transaction', () => {
    expect(migration.config).to.deep.equal({ transaction: false })
  })

  it('matches schema.sql, reverses cleanly and can re-run', async () => {
    const fromSchema = await indexDefinitions()
    expect(fromSchema.activities_post_id_reader_id_index).to.match(/ON public\.activities USING btree \(post_id, reader_id\) WHERE \(post_id IS NOT NULL\)/)
    expect(fromSchema.notifications_activity_id_email_index).to.match(/ON public\.notifications USING btree \(activity_id\) WHERE \(medium = 2\)/)

    await migration.down(bookshelf.knex)
    expect(await indexDefinitions()).to.deep.equal({})

    await migration.up(bookshelf.knex)
    expect(await indexDefinitions()).to.deep.equal(fromSchema)

    await migration.up(bookshelf.knex)
    expect(await indexDefinitions()).to.deep.equal(fromSchema)
  })
})
