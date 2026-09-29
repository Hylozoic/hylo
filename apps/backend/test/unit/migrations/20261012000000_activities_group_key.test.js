/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20261012000000_activities_group_key')

async function indexDefinition (tablename, indexname) {
  const row = await bookshelf.knex('pg_indexes')
    .where({ tablename, indexname })
    .first('indexdef')
  return row ? row.indexdef : null
}

async function groupKeyColumn () {
  const row = await bookshelf.knex('information_schema.columns')
    .where({ table_name: 'activities', column_name: 'group_key' })
    .first('data_type', 'character_maximum_length')
  return row || null
}

const snapshot = async () => ({
  column: await groupKeyColumn(),
  groupKeyIndex: await indexDefinition('activities', 'activities_group_key_reader_id_index'),
  activityIdIndex: await indexDefinition('notifications', 'notifications_activity_id_index')
})

// The indexes are built CONCURRENTLY, which cannot run inside a transaction, so this
// runs against the test database directly and leaves things as schema.sql has them.
describe('migration 20261012000000_activities_group_key', () => {
  before(() => setup.clearDb())

  it('runs outside a transaction', () => {
    expect(migration.config).to.deep.equal({ transaction: false })
  })

  it('matches schema.sql, reverses cleanly and can re-run', async () => {
    const fromSchema = await snapshot()
    expect(fromSchema.column).to.deep.equal({ data_type: 'character varying', character_maximum_length: 255 })
    expect(fromSchema.groupKeyIndex).to.match(/ON public\.activities USING btree \(group_key, reader_id\) WHERE \(group_key IS NOT NULL\)/)
    expect(fromSchema.activityIdIndex).to.match(/ON public\.notifications USING btree \(activity_id\)/)

    await migration.down(bookshelf.knex)
    expect(await snapshot()).to.deep.equal({ column: null, groupKeyIndex: null, activityIdIndex: null })

    await migration.up(bookshelf.knex)
    expect(await snapshot()).to.deep.equal(fromSchema)

    await migration.up(bookshelf.knex)
    expect(await snapshot()).to.deep.equal(fromSchema)
  })
})
