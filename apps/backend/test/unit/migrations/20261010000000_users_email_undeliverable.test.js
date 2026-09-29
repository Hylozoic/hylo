/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20261010000000_users_email_undeliverable')

const ROLLBACK = new Error('rollback')

async function snapshot (trx) {
  const columns = await trx('information_schema.columns')
    .where({ table_schema: 'public', table_name: 'users' })
    .whereIn('column_name', ['email_undeliverable_at', 'email_undeliverable_reason'])
    .orderBy('column_name')
    .select('column_name', 'data_type', 'is_nullable', 'character_maximum_length')
  const comments = await trx.raw(`
    SELECT a.attname, col_description(a.attrelid, a.attnum) AS comment
    FROM pg_attribute a
    WHERE a.attrelid = 'public.users'::regclass
      AND a.attname IN ('email_undeliverable_at', 'email_undeliverable_reason')
    ORDER BY a.attname
  `)
  return {
    columns: columns.map(c => `${c.column_name} ${c.data_type} ${c.is_nullable} ${c.character_maximum_length}`),
    comments: comments.rows.map(r => `${r.attname}: ${r.comment}`)
  }
}

describe('migration 20261010000000_users_email_undeliverable', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  it('matches schema.sql, reverses cleanly and can re-run', async () => {
    try {
      await bookshelf.knex.transaction(async trx => {
        const fromSchema = await snapshot(trx)
        expect(fromSchema.columns).to.deep.equal([
          'email_undeliverable_at timestamp with time zone YES null',
          'email_undeliverable_reason character varying YES 255'
        ])
        expect(fromSchema.comments).to.have.length(2)

        await migration.down(trx)
        expect(await trx.schema.hasColumn('users', 'email_undeliverable_at')).to.equal(false)
        expect(await trx.schema.hasColumn('users', 'email_undeliverable_reason')).to.equal(false)

        await migration.up(trx)
        expect(await snapshot(trx)).to.deep.equal(fromSchema)

        await migration.up(trx)
        expect(await snapshot(trx)).to.deep.equal(fromSchema)

        throw ROLLBACK
      })
    } catch (err) {
      if (err !== ROLLBACK) throw err
    }
  })
})
