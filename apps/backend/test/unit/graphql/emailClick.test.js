import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createRequestHandler } from '../../../api/graphql'
import { clearRateLimits } from '../../../lib/rateLimit'
import { recordEmailClick } from '../../../api/graphql/mutations/emailClick'

describe('recordEmailClick', () => {
  let handler, reader, someoneElse

  before(async () => {
    handler = createRequestHandler()
    reader = await factories.user().save()
    someoneElse = await factories.user().save()
  })

  beforeEach(async () => {
    await bookshelf.knex('email_clicks').del()
  })

  async function run (document, { viewer, ip = '192.0.2.10' } = {}) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.ip = ip
    req.headers = { 'Content-Type': 'application/json' }
    req.session = viewer ? { userId: viewer.id, destroy: () => {} } : {}
    const res = factories.mock.response()
    const { executionResult } = await handler.inject({ document, serverContext: { req, res } })
    return executionResult
  }

  const clicks = () => bookshelf.knex('email_clicks').select('email_type', 'user_id', 'created_at')

  it('records the kind of email and the signed-in person from the session', async () => {
    const result = await run('mutation { recordEmailClick(emailType: "digest_email") { success error } }', { viewer: reader })
    expect(result.errors).to.equal(undefined)
    expect(result.data.recordEmailClick).to.deep.equal({ success: true, error: null })

    const rows = await clicks()
    expect(rows).to.have.length(1)
    expect(rows[0].email_type).to.equal('digest_email')
    expect(String(rows[0].user_id)).to.equal(String(reader.id))
    expect(rows[0].created_at).to.be.an.instanceof(Date)
  })

  it('records a click with no person when nobody is signed in', async () => {
    const result = await run('mutation { recordEmailClick(emailType: "post_mention_email") { success } }')
    expect(result.errors).to.equal(undefined)
    expect(result.data.recordEmailClick.success).to.equal(true)
    const rows = await clicks()
    expect(rows).to.have.length(1)
    expect(rows[0].user_id).to.equal(null)
  })

  it('never takes the person from the link', async () => {
    const result = await run(`mutation { recordEmailClick(emailType: "digest_email", cti: "${someoneElse.id}") { success } }`, { viewer: reader })
    expect(result.errors).to.have.length(1)
    expect(await clicks()).to.have.length(0)
  })

  it('ignores an email type that is not a plain tag', async () => {
    const result = await run('mutation { recordEmailClick(emailType: "<script>alert(1)</script>") { success error } }', { viewer: reader })
    expect(result.data.recordEmailClick).to.deep.equal({ success: false, error: 'invalid-email-type' })
    expect(await clicks()).to.have.length(0)
  })

  it('stops recording after too many clicks from one address', async () => {
    try {
      let last
      for (let i = 0; i < 121; i++) {
        last = await recordEmailClick(null, { emailType: 'digest_email' }, { ip: '192.0.2.99' })
      }
      expect(last.success).to.equal(false)
      expect(await clicks()).to.have.length(120)
    } finally {
      await clearRateLimits().catch(() => {})
    }
  })
})
