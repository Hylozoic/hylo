/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20261001000000_experiment_assignments')

const ROLLBACK = new Error('rollback')

async function snapshot (trx) {
  const columns = await trx('information_schema.columns')
    .where({ table_schema: 'public', table_name: 'experiment_assignments' })
    .orderBy('column_name')
    .select('column_name', 'data_type', 'is_nullable')
  const indexes = await trx('pg_indexes')
    .where({ tablename: 'experiment_assignments' })
    .orderBy('indexname')
    .pluck('indexname')
  return {
    columns: columns.map(c => `${c.column_name} ${c.data_type} ${c.is_nullable}`),
    indexes
  }
}

describe('migration 20261001000000_experiment_assignments', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  it('matches schema.sql, reverses cleanly and can re-run', async () => {
    try {
      await bookshelf.knex.transaction(async trx => {
        const fromSchema = await snapshot(trx)
        expect(fromSchema.columns).to.deep.equal([
          'assigned_at timestamp with time zone NO',
          'experiment character varying NO',
          'id bigint NO',
          'subject_id bigint NO',
          'subject_type character varying NO',
          'variant character varying NO'
        ])
        expect(fromSchema.indexes).to.deep.equal([
          'experiment_assignments_experiment_variant_index',
          'experiment_assignments_pkey',
          'experiment_assignments_subject_unique'
        ])

        await migration.down(trx)
        expect(await trx.schema.hasTable('experiment_assignments')).to.equal(false)

        await migration.up(trx)
        expect(await snapshot(trx)).to.deep.equal(fromSchema)

        await migration.up(trx)
        expect(await snapshot(trx)).to.deep.equal(fromSchema)

        await trx('experiment_assignments').insert({ experiment: 'x', subject_type: 'user', subject_id: 1, variant: 'a' })
        await expect(
          trx.raw('SAVEPOINT dup').then(() =>
            trx('experiment_assignments').insert({ experiment: 'x', subject_type: 'user', subject_id: 1, variant: 'b' }))
        ).to.be.rejectedWith(/duplicate key/)
        await trx.raw('ROLLBACK TO SAVEPOINT dup')

        throw ROLLBACK
      })
    } catch (err) {
      if (err !== ROLLBACK) throw err
    }
  })
})
