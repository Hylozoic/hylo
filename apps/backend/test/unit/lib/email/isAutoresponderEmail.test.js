import { isAutoresponderEmail, parseRawEmailHeaders } from '../../../../lib/email/isAutoresponderEmail'
require('../../../setup')

const rawHeaders = lines => lines.join('\r\n') + '\r\n'

describe('parseRawEmailHeaders', () => {
  it('lowercases names and joins folded values', () => {
    const headers = parseRawEmailHeaders(rawHeaders([
      'From: River <river@example.com>',
      'Subject: Re: a long',
      '\tsubject line',
      'Auto-Submitted: auto-replied'
    ]))
    expect(headers.from).to.equal('River <river@example.com>')
    expect(headers.subject).to.equal('Re: a long subject line')
    expect(headers['auto-submitted']).to.equal('auto-replied')
  })

  it('returns an empty object when there are no headers', () => {
    expect(parseRawEmailHeaders(undefined)).to.deep.equal({})
  })
})

describe('isAutoresponderEmail', () => {
  const genuineReply = {
    headers: rawHeaders(['From: river@example.com', 'Subject: Re: Going on holiday? Out of office plans']),
    envelope: JSON.stringify({ to: ['reply@hylo.com'], from: 'river@example.com' }),
    subject: 'Re: Going on holiday? Out of office plans',
    text: 'Sounds great, count me in!'
  }

  it('lets a genuine reply through, even when the post title mentions being away', () => {
    expect(isAutoresponderEmail(genuineReply)).to.equal(false)
  })

  it('detects Auto-Submitted in the email headers (Gmail vacation responder)', () => {
    expect(isAutoresponderEmail({
      ...genuineReply,
      headers: rawHeaders(['From: river@example.com', 'Auto-Submitted: auto-replied']),
      text: 'Thank you for your email! I am on sabbatical until May 1st.'
    })).to.equal(true)
  })

  it('allows Auto-Submitted: no', () => {
    expect(isAutoresponderEmail({
      ...genuineReply,
      headers: rawHeaders(['From: river@example.com', 'Auto-Submitted: no'])
    })).to.equal(false)
  })

  it('detects X-Autoreply and bulk precedence headers', () => {
    expect(isAutoresponderEmail({ ...genuineReply, headers: rawHeaders(['X-Autoreply: yes']) })).to.equal(true)
    expect(isAutoresponderEmail({ ...genuineReply, headers: rawHeaders(['Precedence: bulk']) })).to.equal(true)
  })

  it('detects an empty envelope sender', () => {
    expect(isAutoresponderEmail({ ...genuineReply, envelope: JSON.stringify({ to: ['reply@hylo.com'], from: '' }) })).to.equal(true)
  })

  it('detects autoresponder subjects', () => {
    const subjects = ['Automatic reply: Re: New post', 'Out of Office: Re: New post', '[Request received] Re: New post', 'Abwesenheitsnotiz: Re: New post']
    subjects.forEach(subject => {
      expect(isAutoresponderEmail({ ...genuineReply, subject })).to.equal(true)
    })
  })

  it('detects help desk ticket acknowledgements', () => {
    expect(isAutoresponderEmail({
      ...genuineReply,
      text: '##- Please type your reply above this line -##\n\nThank you for contacting Mapbox Support!'
    })).to.equal(true)
  })
})
