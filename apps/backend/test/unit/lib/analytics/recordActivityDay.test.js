import { expect } from 'chai'
import { recordActivityDay, resetActivityDayMemo, parseGroupSlug, platformFromHeaders } from '../../../../lib/analytics/recordActivityDay'

const fakeKnex = ({ fail = false } = {}) => {
  const calls = []
  return {
    calls,
    raw: (sql, bindings) => {
      calls.push({ sql, bindings })
      return fail ? Promise.reject(new Error('boom')) : Promise.resolve()
    }
  }
}

describe('recordActivityDay', () => {
  const now = new Date('2026-10-27T12:00:00Z')

  beforeEach(() => resetActivityDayMemo())

  it('records a platform-wide row and a group row once per day', async () => {
    const knex = fakeKnex()
    expect(await recordActivityDay(knex, { userId: 5, groupSlug: 'foo', platform: 'ios', now })).to.equal(true)
    expect(knex.calls).to.have.length(2)
    expect(knex.calls[0].bindings).to.deep.equal(['2026-10-27', 5, 'ios'])
    expect(knex.calls[1].bindings).to.deep.equal(['2026-10-27', 'ios', 5, 'foo'])

    expect(await recordActivityDay(knex, { userId: 5, groupSlug: 'foo', now })).to.equal(false)
    expect(knex.calls).to.have.length(2)
  })

  it('records only the new group when the user moves to another group', async () => {
    const knex = fakeKnex()
    await recordActivityDay(knex, { userId: 5, groupSlug: 'foo', now })
    await recordActivityDay(knex, { userId: 5, groupSlug: 'bar', now })
    expect(knex.calls).to.have.length(3)
    expect(knex.calls[2].bindings[3]).to.equal('bar')
  })

  it('records again on a new UTC day', async () => {
    const knex = fakeKnex()
    await recordActivityDay(knex, { userId: 5, now })
    await recordActivityDay(knex, { userId: 5, now: new Date('2026-10-28T00:00:01Z') })
    expect(knex.calls).to.have.length(2)
  })

  it('logs a failure once, pauses for a minute, then retries', async () => {
    const knex = fakeKnex({ fail: true })
    const logged = []
    const log = err => logged.push(err)
    expect(await recordActivityDay(knex, { userId: 5, now, log })).to.equal(false)
    expect(logged).to.have.length(1)

    expect(await recordActivityDay(knex, { userId: 6, now: new Date(now.getTime() + 1000), log })).to.equal(false)
    expect(knex.calls).to.have.length(1)

    const later = new Date(now.getTime() + 61 * 1000)
    await recordActivityDay(knex, { userId: 5, now: later, log })
    expect(knex.calls).to.have.length(2)
  })
})

describe('parseGroupSlug', () => {
  it('accepts plain slugs and rejects anything else', () => {
    expect(parseGroupSlug('Building-Hylo')).to.equal('building-hylo')
    expect(parseGroupSlug("x'; drop table users")).to.equal(null)
    expect(parseGroupSlug('')).to.equal(null)
    expect(parseGroupSlug(undefined)).to.equal(null)
  })
})

describe('platformFromHeaders', () => {
  it('detects the mobile apps and defaults to web', () => {
    expect(platformFromHeaders({ 'ios-version': '1' })).to.equal('ios')
    expect(platformFromHeaders({ 'android-version': '1' })).to.equal('android')
    expect(platformFromHeaders({})).to.equal('web')
  })
})
