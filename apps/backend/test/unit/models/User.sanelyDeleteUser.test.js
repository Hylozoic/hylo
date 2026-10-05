/* eslint-disable no-unused-expressions */
import '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

describe('User#sanelyDeleteUser', () => {
  before(() => mockify(Queue, 'classMethod', () => Promise.resolve()))
  after(() => unspyify(Queue, 'classMethod'))

  it('removes the daily activity record of the deleted user only', async () => {
    const deleted = await factories.user().save()
    const other = await factories.user().save()
    await bookshelf.knex('user_activity_days').insert([
      { user_id: deleted.id, day: '2026-09-24' },
      { user_id: deleted.id, day: '2026-09-25' },
      { user_id: other.id, day: '2026-09-25' }
    ])

    await deleted.sanelyDeleteUser({ sessionId: 'session' })

    const remaining = await bookshelf.knex('user_activity_days').whereIn('user_id', [deleted.id, other.id]).select('user_id')
    expect(remaining.map(r => String(r.user_id))).to.deep.equal([String(other.id)])
    expect((await User.where({ id: deleted.id }).fetch()).get('name')).to.equal('Deleted User')
  })
})
