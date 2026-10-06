/* eslint-disable no-unused-expressions */
import setup from '../../setup'

const migration = require('../../../migrations/20260927120100_invite_sponsorship')

const ROLLBACK = new Error('rollback')

async function snapshot (trx) {
  const columns = await trx('information_schema.columns')
    .where({ table_schema: 'public' })
    .where(builder => builder
      .where({ table_name: 'group_invites', column_name: 'inviter_access' })
      .orWhere({ table_name: 'join_requests', column_name: 'invitation_id' }))
    .orderBy('table_name')
    .select('table_name', 'column_name', 'column_default', 'is_nullable')
  const constraints = await trx('pg_constraint')
    .whereIn('conname', ['group_invites_inviter_access_check', 'join_requests_invitation_id_foreign', 'invitation_sends_user_id_foreign', 'invitation_sends_group_id_foreign'])
    .orderBy('conname')
    .select('conname', 'confdeltype', 'convalidated')
  const indexes = await trx('pg_indexes')
    .where('indexname', 'like', 'join_requests_invitation_id%')
    .orWhere('tablename', 'invitation_sends')
    .orderBy('indexname')
    .pluck('indexname')
  return {
    columns: columns.map(c => `${c.table_name}.${c.column_name} ${c.column_default} ${c.is_nullable}`),
    constraints: constraints.map(c => `${c.conname} ${c.confdeltype} ${c.convalidated}`),
    indexes,
    ledger: await trx.schema.hasTable('invitation_sends')
  }
}

describe('migration 20260927120100_invite_sponsorship', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  it('adds invite sponsorship columns and the ledger, reverses cleanly and can re-run', async () => {
    try {
      await bookshelf.knex.transaction(async trx => {
        const now = new Date()
        const [userId] = await trx('users').insert({ name: 'Migr', email: 'migr-sponsor@example.com', created_at: now }).returning('id')
        const [groupId] = await trx('groups').insert({ name: 'migr-sponsor', slug: 'migr-sponsor', access_code: 'migr-sponsor', created_at: now }).returning('id')
        const invite = attrs => trx('group_invites')
          .insert({ group_id: groupId, invited_by_id: userId, token: attrs.email, created_at: now, ...attrs })
          .returning('id')
          .then(([id]) => id)
        const limitedId = await invite({ email: 'limited@example.com', inviter_access: 'limited' })
        const usedLimitedId = await invite({ email: 'used@example.com', inviter_access: 'limited', used_by_id: userId, used_at: now })
        const fullId = await invite({ email: 'full@example.com' })

        // Fire deferred FK checks between steps, as separate migration runs would
        const flush = () => trx.raw('SET CONSTRAINTS ALL IMMEDIATE')
        await flush()

        const expected = await snapshot(trx)
        expect(expected.columns).to.deep.equal([
          "group_invites.inviter_access 'full'::character varying NO",
          'join_requests.invitation_id null YES'
        ])
        expect(expected.constraints).to.deep.equal([
          'group_invites_inviter_access_check   true',
          'invitation_sends_group_id_foreign c true',
          'invitation_sends_user_id_foreign c true',
          'join_requests_invitation_id_foreign n true'
        ])
        expect(expected.indexes).to.deep.equal([
          'invitation_sends_group_id_created_at_index',
          'invitation_sends_pkey',
          'invitation_sends_user_id_created_at_index',
          'join_requests_invitation_id_index'
        ])

        await migration.down(trx)
        await flush()
        expect(await snapshot(trx)).to.deep.equal({ columns: [], constraints: [], indexes: [], ledger: false })

        const byId = async id => trx('group_invites').where({ id }).first()
        const limited = await byId(limitedId)
        expect(String(limited.expired_by_id)).to.equal(String(userId))
        expect(limited.expired_at).to.exist
        expect((await byId(usedLimitedId)).expired_by_id).to.be.null
        expect((await byId(fullId)).expired_by_id).to.be.null

        await migration.up(trx)
        await flush()
        expect(await snapshot(trx)).to.deep.equal(expected)
        expect((await byId(fullId)).inviter_access).to.equal('full')

        await migration.up(trx)
        await flush()
        expect(await snapshot(trx)).to.deep.equal(expected)

        const [joinRequestId] = await trx('join_requests')
          .insert({ group_id: groupId, user_id: userId, status: 0, invitation_id: fullId, created_at: now })
          .returning('id')
        await flush()
        await trx('group_invites').where({ id: fullId }).del()
        expect((await trx('join_requests').where({ id: joinRequestId }).first()).invitation_id).to.be.null

        await expect(invite({ email: 'bad@example.com', inviter_access: 'other' }))
          .to.be.rejectedWith(/group_invites_inviter_access_check/)

        throw ROLLBACK
      })
    } catch (err) {
      if (err !== ROLLBACK) throw err
    }
  })
})
