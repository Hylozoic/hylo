// What deleting an account removes from the analytics tables (first-touch source and
// email clicks)
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'

describe('User#sanelyDeleteUser and analytics records', () => {
  let user

  before(() => mockify(Queue, 'classMethod', () => Promise.resolve()))

  after(() => unspyify(Queue, 'classMethod'))

  beforeEach(async () => {
    await setup.clearDb()
    user = await factories.user({ acquisition_source: { source: 'example.org' } }).save()
  })

  it('clears where the account first came from', async () => {
    const before = await bookshelf.knex('users').where({ id: user.id }).first('acquisition_source')
    expect(before.acquisition_source).to.deep.equal({ source: 'example.org' })

    await user.sanelyDeleteUser({ sessionId: 'session' })

    const row = await bookshelf.knex('users').where({ id: user.id }).first('acquisition_source')
    expect(row.acquisition_source).to.equal(null)
  })

  it('keeps email clicks but no longer ties them to the person', async () => {
    const other = await factories.user().save()
    await bookshelf.knex('email_clicks').insert([
      { email_type: 'post_email', user_id: user.id },
      { email_type: 'post_email', user_id: other.id }
    ])

    await user.sanelyDeleteUser({ sessionId: 'session' })

    const clicks = await bookshelf.knex('email_clicks').orderBy('id').select('user_id')
    expect(clicks.map(c => c.user_id && String(c.user_id))).to.deep.equal([null, String(other.id)])
  })
})
