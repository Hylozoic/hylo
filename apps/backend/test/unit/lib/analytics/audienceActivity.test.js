import { expect } from 'chai'
import { audienceActivity } from '../../../../lib/analytics/audienceActivity'
import { readSeries } from '../../../../lib/analytics/readMetrics'

function queryKnex (rows) {
  const calls = []
  const chain = {
    where () { return chain },
    whereIn () { return chain },
    select () { return Promise.resolve([]) }
  }
  const knex = () => chain
  knex.raw = (sql, bindings) => {
    calls.push({ sql, bindings })
    return Promise.resolve({ rows })
  }
  return { knex, calls }
}

describe('audienceActivity', () => {
  it('counts visits and actions, and looks back 30 days so a month is complete', async () => {
    const { knex, calls } = queryKnex([
      { period_start: '2026-11-01', dau: 4, wau: 11, mau: 30 },
      { period_start: '2026-11-02', dau: 5, wau: 12, mau: 31 }
    ])
    const points = await audienceActivity({ knex, groupId: 0, from: '2026-11-01', to: '2026-11-02' })
    expect(calls[0].sql).to.include('activity_events')
    expect(calls[0].sql).to.include('activity_days')
    expect(calls[0].bindings[0]).to.equal('2026-10-02T00:00:00.000Z')
    expect(calls[0].bindings[4]).to.equal(0)
    expect(points.active_users.map(point => point.value)).to.deep.equal([4, 5])
    expect(points.wau.map(point => point.value)).to.deep.equal([11, 12])
    expect(points.mau.map(point => point.value)).to.deep.equal([30, 31])
  })

  it('limits the count to one group', async () => {
    const { knex, calls } = queryKnex([])
    await audienceActivity({ knex, groupId: '42', from: '2026-11-01', to: '2026-11-01' })
    expect(calls[0].bindings[4]).to.equal(42)
    expect(calls[0].bindings[5]).to.equal(42)
  })
})

describe('readSeries audience counts', () => {
  it('uses the live daily, weekly and monthly counts instead of a one-day snapshot', async () => {
    const { knex } = queryKnex([
      { period_start: '2026-11-01', dau: 2, wau: 8, mau: 20 },
      { period_start: '2026-11-02', dau: 3, wau: 9, mau: 21 }
    ])
    const series = await readSeries({
      knex,
      groupId: 0,
      metrics: ['active_users', 'wau', 'mau'],
      period: 'day',
      from: '2026-11-01',
      to: '2026-11-02'
    })
    const value = metric => series.find(item => item.metric === metric).points.map(point => point.value)
    expect(value('active_users')).to.deep.equal([2, 3])
    expect(value('wau')).to.deep.equal([8, 9])
    expect(value('mau')).to.deep.equal([20, 21])
  })
})
