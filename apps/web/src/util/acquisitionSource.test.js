import {
  ACQUISITION_SOURCE_KEY,
  acquisitionSourceInput,
  captureAcquisitionSource,
  markSandboxSignup,
  readAcquisitionSource
} from './acquisitionSource'

const at = (path, referrer = '') => {
  const url = new URL(path, 'https://www.hylo.com')
  return { location: { hostname: url.hostname, pathname: url.pathname, search: url.search }, referrer }
}

beforeEach(() => {
  window.localStorage.clear()
  jest.restoreAllMocks()
})

describe('captureAcquisitionSource', () => {
  it('keeps the utm tags, each capped', () => {
    const long = 'x'.repeat(200)
    captureAcquisitionSource(at(`/signup?utm_source=newsletter&utm_medium=email&utm_campaign=${long}&utm_content=ignored`))
    expect(readAcquisitionSource()).toEqual({
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'x'.repeat(64)
    })
  })

  it('keeps only the host name of an external referrer', () => {
    captureAcquisitionSource(at('/login', 'https://news.example.org/story/123?ref=abc#top'))
    expect(readAcquisitionSource()).toEqual({ referrer: 'news.example.org' })
  })

  it('ignores a referrer from Hylo itself or one it cannot read', () => {
    captureAcquisitionSource(at('/login', 'https://www.hylo.com/groups/garden'))
    captureAcquisitionSource(at('/login', 'not a url'))
    expect(readAcquisitionSource()).toBeNull()
  })

  it.each([
    '/groups/garden-club/join/abc123',
    '/h/use-invitation?token=abc&email=ada%40example.com',
    '/h/invitation?token=abc'
  ])('marks %s as an invite', path => {
    captureAcquisitionSource(at(path))
    expect(readAcquisitionSource()).toEqual({ channel: 'invite' })
    expect(JSON.stringify(readAcquisitionSource())).not.toMatch(/abc|ada/)
  })

  it('lets the first touch win', () => {
    captureAcquisitionSource(at('/signup?utm_source=first', 'https://one.example'))
    captureAcquisitionSource(at('/signup?utm_source=second&utm_medium=later', 'https://two.example'))
    expect(readAcquisitionSource()).toEqual({ referrer: 'one.example', utmSource: 'first' })
  })

  it('does not let a visit with nothing to record use up the first touch', () => {
    captureAcquisitionSource(at('/login'))
    expect(readAcquisitionSource()).toBeNull()
    captureAcquisitionSource(at('/signup?utm_source=later'))
    expect(readAcquisitionSource()).toEqual({ utmSource: 'later' })
  })

  it('adds the invite channel to an earlier referrer, but never replaces a channel', () => {
    captureAcquisitionSource(at('/login', 'https://one.example'))
    captureAcquisitionSource(at('/groups/garden-club/join/abc123'))
    markSandboxSignup()
    expect(readAcquisitionSource()).toEqual({ referrer: 'one.example', channel: 'invite' })
  })

  it('keeps working when storage is unavailable', () => {
    jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => captureAcquisitionSource(at('/signup?utm_source=x'))).not.toThrow()
    expect(() => markSandboxSignup()).not.toThrow()
    expect(readAcquisitionSource()).toBeNull()
    expect(acquisitionSourceInput()).toBeUndefined()
  })

  it('ignores a stored value it cannot read', () => {
    window.localStorage.setItem(ACQUISITION_SOURCE_KEY, '{oops')
    expect(readAcquisitionSource()).toBeNull()
    captureAcquisitionSource(at('/signup?utm_source=x'))
    expect(readAcquisitionSource()).toEqual({ utmSource: 'x' })
  })
})

describe('markSandboxSignup', () => {
  it('marks a signup from the demo banner', () => {
    captureAcquisitionSource(at('/sandbox/groups/demo', 'https://blog.example'))
    markSandboxSignup()
    expect(readAcquisitionSource()).toEqual({ referrer: 'blog.example', channel: 'sandbox_demo' })
  })
})

describe('acquisitionSourceInput', () => {
  it('returns the stored source in the GraphQL input shape', () => {
    window.localStorage.setItem(ACQUISITION_SOURCE_KEY, JSON.stringify({ referrer: 'one.example', utmSource: 's', channel: 'invite', extra: 'dropped' }))
    expect(acquisitionSourceInput()).toEqual({ referrer: 'one.example', utmSource: 's', channel: 'invite' })
  })

  it('returns undefined when nothing is stored', () => {
    expect(acquisitionSourceInput()).toBeUndefined()
  })
})
