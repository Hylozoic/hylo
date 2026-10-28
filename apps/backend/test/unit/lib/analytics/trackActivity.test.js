import { expect } from 'chai'
import { buildEventRows, trackActivity, EVENT_TYPES } from '../../../../lib/analytics/trackActivity'

describe('buildEventRows', () => {
  it('makes one row per distinct group', () => {
    const rows = buildEventRows({
      type: EVENT_TYPES.POST_CREATED,
      userId: 1,
      groupIds: [10, 11, 10, null],
      object: { type: 'post', id: 99 },
      postType: 'request',
      properties: { a: 1 }
    })
    expect(rows.map(r => r.group_id)).to.deep.equal(['10', '11'])
    expect(rows[0]).to.include({ event_type: 'post_created', user_id: 1, object_type: 'post', object_id: 99, post_type: 'request', source: 'live' })
    expect(rows[0].properties).to.equal('{"a":1}')
  })

  it('uses group 0 when the action is not group-scoped', () => {
    const rows = buildEventRows({ type: EVENT_TYPES.SIGNUP_COMPLETED, userId: 1 })
    expect(rows).to.have.length(1)
    expect(rows[0].group_id).to.equal('0')
  })

  it('returns nothing without a type or user', () => {
    expect(buildEventRows({ userId: 1 })).to.deep.equal([])
    expect(buildEventRows({ type: 'x' })).to.deep.equal([])
  })
})

describe('trackActivity', () => {
  it('swallows and logs database errors', async () => {
    const logged = []
    const chain = {
      insert: () => chain,
      onConflict: () => chain,
      ignore: () => Promise.reject(new Error('boom'))
    }
    const knex = Object.assign(() => chain, { raw: () => 'raw' })
    const result = await trackActivity(knex, { type: 'post_created', userId: 1 }, { log: err => logged.push(err) })
    expect(result).to.equal(0)
    expect(logged).to.have.length(1)
  })

  it('does nothing for an invalid event', async () => {
    expect(await trackActivity(() => { throw new Error('should not be called') }, {})).to.equal(0)
  })
})
