import { expect } from 'chai'
import { GraphQLError } from 'graphql'
import { normalizeGroupBy, queryActivityCounts, storedRangeEnd } from '../../../../lib/analytics/dailyCounts'
import { currentPlatform, runWithRequestContext } from '../../../../lib/analytics/requestContext'

function capturingKnex () {
  const calls = []
  const knex = Object.assign(() => {}, {
    raw: (sql, bindings) => {
      calls.push({ sql, bindings })
      return Promise.resolve({ rows: [] })
    }
  })
  return { knex, calls }
}

describe('storedRangeEnd', () => {
  it('leaves today out of the stored table', () => {
    expect(storedRangeEnd('2026-10-01', '2026-10-31', '2026-10-31')).to.equal('2026-10-30')
    expect(storedRangeEnd('2026-10-31', '2026-10-31', '2026-10-31')).to.equal(null)
    expect(storedRangeEnd('2026-10-01', '2026-10-20', '2026-10-31')).to.equal('2026-10-20')
  })
})

describe('normalizeGroupBy', () => {
  it('maps allowlisted names to columns', () => {
    expect(normalizeGroupBy(['postType', 'platform'])).to.deep.equal(['post_type', 'platform'])
  })

  it('rejects an unknown split', () => {
    expect(() => normalizeGroupBy(['email'])).to.throw(GraphQLError)
  })
})

describe('queryActivityCounts', () => {
  it('reads stored days and counts today from the event log', async () => {
    const { knex, calls } = capturingKnex()
    await queryActivityCounts(knex, {
      groupId: '5',
      period: 'week',
      from: '2026-10-01',
      to: '2026-10-31',
      today: '2026-10-31',
      groupBy: ['postType', 'isPublic'],
      filter: { eventTypes: ['post_created'], postTypes: ['request'] }
    })
    const { sql, bindings } = calls[0]
    expect(sql.match(/\?/g)).to.have.length(bindings.length)
    expect(sql).to.include('activity_daily_counts')
    expect(sql).to.include('activity_events')
    expect(sql).to.include('post_type')
    expect(sql).to.include('is_public')
    expect(bindings).to.include('2026-10-30')
    expect(bindings).to.include('5')
    expect(bindings).to.deep.include(['post_created'])
    expect(bindings).to.deep.include(['request'])
  })

  it('does not query the event log for a closed range', async () => {
    const { knex, calls } = capturingKnex()
    await queryActivityCounts(knex, {
      groupId: 0,
      period: 'day',
      from: '2026-10-01',
      to: '2026-10-20',
      today: '2026-10-31'
    })
    expect(calls[0].sql).to.include('activity_daily_counts')
    expect(calls[0].sql).to.not.include('activity_events')
  })

  it('rejects an unknown event type', async () => {
    const { knex } = capturingKnex()
    try {
      await queryActivityCounts(knex, {
        groupId: 0,
        period: 'day',
        from: '2026-10-01',
        to: '2026-10-02',
        today: '2026-10-31',
        filter: { eventTypes: ['email'] }
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).to.be.instanceOf(GraphQLError)
    }
  })
})

describe('requestContext', () => {
  it('exposes the platform only inside the request', () => {
    expect(currentPlatform()).to.equal(null)
    runWithRequestContext({ platform: 'ios' }, () => {
      expect(currentPlatform()).to.equal('ios')
    })
    expect(currentPlatform()).to.equal(null)
  })
})
