/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai')
const { recordActivityDay, pruneActivityDays, resetActivityDayMemo } = require('../../../lib/userActivityDays')

function fakeKnex ({ fail = false } = {}) {
  const deletes = []
  const state = { fail }
  const knex = table => {
    const query = { table, where: [] }
    const builder = {
      where: (...args) => { query.where.push(args); return builder },
      del: async () => { deletes.push(query); return 3 }
    }
    return builder
  }
  knex.raw = spy(async () => {
    if (state.fail) throw new Error('relation "user_activity_days" does not exist')
    return { rows: [] }
  })
  knex.deletes = deletes
  knex.state = state
  return knex
}

describe('userActivityDays', () => {
  beforeEach(() => resetActivityDayMemo())

  it('records a user once per UTC day', async () => {
    const knex = fakeKnex()
    const now = new Date('2026-09-25T10:00:00Z')
    expect(await recordActivityDay(knex, 42, { now })).to.equal(true)
    expect(await recordActivityDay(knex, 42, { now: new Date('2026-09-25T23:59:00Z') })).to.equal(false)
    expect(knex.raw).to.have.been.called.once
    expect(knex.raw.__spy.calls[0][1]).to.deep.equal([42, '2026-09-25'])
  })

  it('records each user separately and again on the next UTC day', async () => {
    const knex = fakeKnex()
    await recordActivityDay(knex, 1, { now: new Date('2026-09-25T10:00:00Z') })
    await recordActivityDay(knex, 2, { now: new Date('2026-09-25T10:00:00Z') })
    await recordActivityDay(knex, 1, { now: new Date('2026-09-26T00:00:01Z') })
    expect(knex.raw).to.have.been.called.exactly(3)
    expect(knex.raw.__spy.calls[2][1]).to.deep.equal([1, '2026-09-26'])
  })

  it('uses the UTC day, not the server time zone', async () => {
    const knex = fakeKnex()
    await recordActivityDay(knex, 7, { now: new Date('2026-09-25T23:30:00-07:00') })
    expect(knex.raw.__spy.calls[0][1]).to.deep.equal([7, '2026-09-26'])
  })

  it('never rejects, pauses for a minute after a failure, and then retries the same day', async () => {
    const knex = fakeKnex({ fail: true })
    const log = spy()
    const t0 = new Date('2026-09-25T10:00:00Z')
    const at = seconds => new Date(t0.getTime() + seconds * 1000)
    expect(await recordActivityDay(knex, 1, { now: t0, log })).to.equal(false)
    expect(await recordActivityDay(knex, 2, { now: at(1), log })).to.equal(false)
    expect(await recordActivityDay(knex, 1, { now: at(2), log })).to.equal(false)
    expect(log).to.have.been.called.once
    expect(knex.raw).to.have.been.called.once

    expect(await recordActivityDay(knex, 1, { now: at(61), log })).to.equal(false)
    expect(knex.raw).to.have.been.called.twice
    expect(log).to.have.been.called.twice

    knex.state.fail = false
    expect(await recordActivityDay(knex, 1, { now: at(122), log })).to.equal(true)
    expect(await recordActivityDay(knex, 2, { now: at(123), log })).to.equal(true)
    expect(await recordActivityDay(knex, 1, { now: at(124), log })).to.equal(false)
    expect(knex.raw).to.have.been.called.exactly(4)
    expect(log).to.have.been.called.twice
  })

  it('logs once when several inserts in flight fail together', async () => {
    const knex = fakeKnex({ fail: true })
    const log = spy()
    const now = new Date('2026-09-25T10:00:00Z')
    const results = await Promise.all([1, 2, 3].map(id => recordActivityDay(knex, id, { now, log })))
    expect(results).to.deep.equal([false, false, false])
    expect(knex.raw).to.have.been.called.exactly(3)
    expect(log).to.have.been.called.once
  })

  it('prunes rows older than the retention window', async () => {
    const knex = fakeKnex()
    const removed = await pruneActivityDays(knex, { now: new Date('2026-09-25T12:00:00Z') })
    expect(removed).to.equal(3)
    expect(knex.deletes).to.have.length(1)
    expect(knex.deletes[0].table).to.equal('user_activity_days')
    expect(knex.deletes[0].where).to.deep.equal([['day', '<', '2024-09-25']])
  })
})
