/* eslint-disable no-unused-expressions */
import { sanitizeAcquisitionSource } from '../../../lib/acquisitionSource'
import { sendEmailVerification } from '../../../api/graphql/mutations/user'
import factories from '../../setup/factories'
require('../../setup')

describe('sanitizeAcquisitionSource', () => {
  it('keeps the allowed fields in the stored shape', () => {
    expect(sanitizeAcquisitionSource({
      referrer: 'news.example.org',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'spring',
      channel: 'invite'
    })).to.deep.equal({
      referrer: 'news.example.org',
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'spring',
      channel: 'invite'
    })
  })

  it('trims oversized values and keeps only a host name for the referrer', () => {
    expect(sanitizeAcquisitionSource({
      referrer: 'https://News.Example.org/story/123?ref=abc',
      utmSource: 'x'.repeat(500),
      utmCampaign: 'line\nbreak'
    })).to.deep.equal({
      referrer: 'news.example.org',
      utm_source: 'x'.repeat(64),
      utm_campaign: 'linebreak'
    })
  })

  it('drops unknown keys, unknown channels and values that are not text', () => {
    expect(sanitizeAcquisitionSource({ email: 'ada@example.com', channel: 'ads', utmSource: 42, referrer: 'not a host!' })).to.be.null
    expect(sanitizeAcquisitionSource({ channel: 'sandbox_demo', userId: 5 })).to.deep.equal({ channel: 'sandbox_demo' })
  })

  it('accepts a JSON string and ignores anything unreadable', () => {
    expect(sanitizeAcquisitionSource('{"utmSource":"a"}')).to.deep.equal({ utm_source: 'a' })
    expect(sanitizeAcquisitionSource('{oops')).to.be.null
    expect(sanitizeAcquisitionSource(['a'])).to.be.null
    expect(sanitizeAcquisitionSource(null)).to.be.null
    expect(sanitizeAcquisitionSource('x'.repeat(5000))).to.be.null
  })
})

describe('User acquisition source', () => {
  it('is stored, cleaned, when the user is created', async () => {
    const user = await User.create({
      email: `first-touch-${Date.now()}@example.com`,
      name: 'First Touch',
      acquisitionSource: { referrer: 'https://blog.example/post', utmSource: 's'.repeat(80), extra: 'dropped' },
      acquisition_source: { channel: 'invite', note: 'raw values are never taken' }
    })
    await user.refresh()
    expect(user.get('acquisition_source')).to.deep.equal({ referrer: 'blog.example', utm_source: 's'.repeat(64) })
  })

  it('stays empty when nothing usable was sent', async () => {
    const user = await User.create({ email: `no-touch-${Date.now()}@example.com`, name: 'No Touch' })
    await user.refresh()
    expect(user.get('acquisition_source')).to.be.null
  })

  describe('through sendEmailVerification', () => {
    const context = { req: { ip: '203.0.113.30' } }

    it('is kept on the account the signup creates', async () => {
      const email = `stub-${Date.now()}@example.com`
      const result = await sendEmailVerification(null, { email, acquisitionSource: { utmSource: 'newsletter', channel: 'invite' } }, context)
      expect(result).to.deep.equal({ success: true })
      const user = await User.query(q => q.whereRaw('lower(email) = ?', email)).fetch()
      expect(user.get('acquisition_source')).to.deep.equal({ utm_source: 'newsletter', channel: 'invite' })
    })

    it('never changes the source of an account that already exists', async () => {
      const existing = await User.create({ email: `existing-${Date.now()}@example.com`, name: 'Existing', acquisitionSource: { channel: 'invite' } })
      await sendEmailVerification(null, { email: existing.get('email'), acquisitionSource: { utmSource: 'later' } }, context)
      await existing.refresh()
      expect(existing.get('acquisition_source')).to.deep.equal({ channel: 'invite' })

      const withoutSource = await factories.user().save()
      await sendEmailVerification(null, { email: withoutSource.get('email'), acquisitionSource: { utmSource: 'later' } }, context)
      await withoutSource.refresh()
      expect(withoutSource.get('acquisition_source')).to.be.null
    })
  })
})
