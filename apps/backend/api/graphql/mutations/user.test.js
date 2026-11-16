/* eslint-disable no-unused-expressions */
import '../../../test/setup'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { clearRateLimits } from '../../../lib/rateLimit'
import { sanitizeReturnToUrl, sendEmailVerification } from './user'

describe('sanitizeReturnToUrl', () => {
  it('keeps paths on this site, with their query', () => {
    expect(sanitizeReturnToUrl('/post/91?action=unfollow')).to.equal('/post/91?action=unfollow')
    expect(sanitizeReturnToUrl('/groups/garden/about?accessCode=abc')).to.equal('/groups/garden/about?accessCode=abc')
  })

  it('drops anything that could lead off the site', () => {
    for (const value of ['https://evil.example/x', '//evil.example/x', '/\\evil.example', 'groups/x', '', null, undefined, 42, '/' + 'a'.repeat(2000)]) {
      expect(sanitizeReturnToUrl(value)).to.be.null
    }
  })
})

describe('sendEmailVerification', () => {
  let sent

  beforeEach(() => {
    sent = []
    clearRateLimits()
    mockify(Queue, 'classMethod', (model, method, data) => {
      sent.push({ model, method, data })
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  const context = { req: { ip: '203.0.113.41' } }

  it('puts the return path on the emailed link', async () => {
    const email = `return-path-${Date.now()}@example.com`
    expect(await sendEmailVerification(null, { email, returnToUrl: '/post/91?action=unfollow' }, context))
      .to.deep.equal({ success: true })

    expect(sent).to.have.length(1)
    const url = new URL(sent[0].data.templateData.verify_url)
    expect(url.pathname).to.equal('/signup/verify-email')
    expect(url.searchParams.get('email')).to.equal(email)
    expect(url.searchParams.get('token')).to.be.ok
    expect(url.searchParams.get('returnToUrl')).to.equal('/post/91?action=unfollow')
  })

  it('leaves the return path off when there is none, or it points off the site', async () => {
    for (const returnToUrl of [undefined, 'https://evil.example/x']) {
      const email = `no-return-path-${Date.now()}-${sent.length}@example.com`
      expect(await sendEmailVerification(null, { email, returnToUrl }, context)).to.deep.equal({ success: true })
    }

    expect(sent).to.have.length(2)
    for (const { data } of sent) {
      const url = new URL(data.templateData.verify_url)
      expect(url.searchParams.has('returnToUrl')).to.be.false
      expect(url.searchParams.get('token')).to.be.ok
    }
  })
})
