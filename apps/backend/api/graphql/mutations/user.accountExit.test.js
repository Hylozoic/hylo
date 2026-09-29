/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { deactivateUser, deleteUser } from './user'

describe('leaving Hylo: deactivateUser and deleteUser', () => {
  let queued

  before(() => setup.clearDb())
  after(() => setup.clearDb())

  beforeEach(() => {
    queued = []
    mockify(Queue, 'classMethod', (cls, method, data) => {
      queued.push([cls, method, data])
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  const accountEmails = () => queued.filter(([cls, method]) => cls === 'Email' && method === 'sendAccountClosed').map(([, , data]) => data)

  it('deactivates, keeps the reason with the account, and queues the confirmation in their language', async () => {
    const user = await factories.user({ name: 'Rowan Leaf', email: 'rowan.leaf@example.com', settings: { locale: 'fr' } }).save()

    expect(await deactivateUser({ userId: user.id, reason: 'too_many_emails' })).to.deep.equal({ success: true })

    await user.refresh()
    expect(user.get('active')).to.be.false
    const rows = await bookshelf.knex('account_exit_reasons').where({ user_id: user.id })
    expect(rows.map(row => [row.kind, row.reason])).to.deep.equal([['deactivated', 'too_many_emails']])

    const [email] = accountEmails()
    expect(email.email).to.equal('rowan.leaf@example.com')
    expect(email.locale).to.equal('fr-FR')
    expect(email.data).to.include({ variant: 'deactivated', first_name: 'Rowan' })
    expect(email.data.login_url).to.match(/\/login$/)
  })

  it('stores no reason when none, or an unknown one, is given, and still sends the confirmation', async () => {
    const user = await factories.user().save()
    await deactivateUser({ userId: user.id })
    const other = await factories.user().save()
    await deactivateUser({ userId: other.id, reason: 'something invented' })

    expect(await bookshelf.knex('account_exit_reasons').whereIn('user_id', [user.id, other.id])).to.have.length(0)
    expect(accountEmails()).to.have.length(2)
  })

  it('deletes, keeps the reason without any user id, and queues the confirmation to the address it had', async () => {
    const user = await factories.user({ name: 'Sky Fern', email: 'sky.fern@example.com', settings: { locale: 'de' } }).save()
    await bookshelf.knex('account_exit_reasons').insert({ kind: 'deactivated', reason: 'not_useful', user_id: user.id })

    expect(await deleteUser({ userId: user.id, reason: 'privacy' })).to.deep.equal({ success: true })

    const wiped = await User.find(user.id, {}, false)
    expect(wiped.get('email')).to.not.equal('sky.fern@example.com')
    expect(await bookshelf.knex('account_exit_reasons').where({ user_id: user.id })).to.have.length(0)
    const deleted = await bookshelf.knex('account_exit_reasons').where({ kind: 'deleted', reason: 'privacy' })
    expect(deleted).to.have.length(1)
    expect(deleted[0].user_id).to.be.null

    const [email] = accountEmails()
    expect(email.email).to.equal('sky.fern@example.com')
    expect(email.locale).to.equal('de-DE')
    expect(email.data).to.include({ variant: 'deleted', first_name: 'Sky' })
  })

  it('never keeps a user id on a deletion', async () => {
    const user = await factories.user().save()
    await expect(bookshelf.knex('account_exit_reasons').insert({ kind: 'deleted', reason: 'other', user_id: user.id }))
      .to.be.rejectedWith(/account_exit_reasons_deleted_has_no_user/)
  })

  it('skips the confirmation until its SendWithUs template id is set', async () => {
    const sent = await Email.sendAccountClosed({ email: 'x@example.com', locale: 'en-US', data: { variant: 'deleted' } })
    expect(sent).to.equal(false)
  })
})
