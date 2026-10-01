jest.mock('mixpanel-browser', () => ({
  init: jest.fn(),
  identify: jest.fn(),
  people: { set: jest.fn() },
  set_group: jest.fn(),
  get_group: jest.fn(() => ({ set: jest.fn() })),
  has_opted_out_tracking: jest.fn(() => false),
  opt_out_tracking: jest.fn(),
  opt_in_tracking: jest.fn()
}))

jest.mock('config/index', () => ({
  __esModule: true,
  default: { mixpanel: { token: 'test-token' } },
  isTest: false,
  isProduction: false
}))

jest.mock('sandbox/isSandbox', () => ({
  isSandboxMode: jest.fn(() => false)
}))

// Each test gets fresh module state (the init flag) and matching mock instances
function load ({ consent = null, sandbox = false, token = 'test-token', optedOut = false } = {}) {
  const modules = {}
  jest.isolateModules(() => {
    modules.config = require('config/index').default
    modules.config.mixpanel.token = token
    require('sandbox/isSandbox').isSandboxMode.mockReturnValue(sandbox)
    require('util/cookieConsent').getCookieConsent.mockReturnValue(consent)
    modules.mixpanel = require('mixpanel-browser')
    modules.mixpanel.has_opted_out_tracking.mockReturnValue(optedOut)
    modules.analytics = require('./analytics')
  })
  return modules
}

describe('resolveAnalyticsChoice', () => {
  const saved = analytics => ({ id: '1', settings: { analytics, support: true }, updatedAt: '2026-01-01T00:00:00.000Z' })

  it.each([
    ['the cookie accepted', { analytics: true }, saved(false), true],
    ['the cookie rejected', { analytics: false }, undefined, false],
    ['there is no cookie and the account rejected', null, saved(false), false],
    ['there is no cookie and the account accepted', null, saved(true), true],
    ['there is no cookie and the account has no saved choice', null, null, null],
    ['there is no cookie and the account has not loaded yet', null, undefined, undefined]
  ])('when %s', (_, cookieConsent, accountPreferences, expected) => {
    const { analytics } = load()
    expect(analytics.resolveAnalyticsChoice(cookieConsent, accountPreferences)).toBe(expected)
  })
})

describe('analyticsAllowed', () => {
  it.each([
    ['nobody has answered the cookie panel', null, {}, true],
    ['analytics were accepted', true, {}, true],
    ['analytics were rejected', false, {}, false],
    ['the choice is not known yet', undefined, {}, false],
    ['in the sandbox', true, { sandbox: true }, false],
    ['without a Mixpanel token', true, { token: '' }, false]
  ])('when %s', (_, choice, options, expected) => {
    const { analytics } = load(options)
    expect(analytics.analyticsAllowed(choice)).toBe(expected)
  })
})

describe('applyAnalyticsConsent', () => {
  it('does nothing before Mixpanel is initialized', () => {
    const { analytics, mixpanel } = load()
    analytics.applyAnalyticsConsent({ analytics: false })
    expect(mixpanel.opt_out_tracking).not.toHaveBeenCalled()
  })

  it('opts out when analytics are rejected, without deleting the profile', () => {
    const { analytics, mixpanel } = load()
    analytics.initAnalytics()
    analytics.applyAnalyticsConsent({ analytics: false, support: true })
    expect(mixpanel.opt_out_tracking).toHaveBeenCalledWith({ delete_user: false })
    expect(mixpanel.opt_in_tracking).not.toHaveBeenCalled()
  })

  it('opts back in when analytics are accepted after an opt-out', () => {
    const { analytics, mixpanel } = load({ optedOut: true })
    analytics.initAnalytics()
    analytics.applyAnalyticsConsent({ analytics: true, support: true })
    expect(mixpanel.opt_in_tracking).toHaveBeenCalledTimes(1)
    expect(mixpanel.opt_out_tracking).not.toHaveBeenCalled()
  })

  it('leaves Mixpanel alone when the choice already matches or was never made', () => {
    const { analytics, mixpanel } = load({ optedOut: true })
    analytics.initAnalytics()
    analytics.applyAnalyticsConsent({ analytics: false })
    analytics.applyAnalyticsConsent(null)
    expect(mixpanel.opt_out_tracking).not.toHaveBeenCalled()
    expect(mixpanel.opt_in_tracking).not.toHaveBeenCalled()
  })
})

describe('initAnalytics', () => {
  it('opts out at startup when the stored consent already rejects analytics', () => {
    const { analytics, mixpanel } = load({ consent: { analytics: false, support: false } })
    analytics.initAnalytics()
    expect(mixpanel.init).toHaveBeenCalledWith('test-token', { debug: true })
    expect(mixpanel.opt_out_tracking).toHaveBeenCalledWith({ delete_user: false })
  })

  it('initializes only once', () => {
    const { analytics, mixpanel } = load()
    analytics.initAnalytics()
    analytics.initAnalytics()
    expect(mixpanel.init).toHaveBeenCalledTimes(1)
  })

  it('does not initialize in the sandbox', () => {
    const { analytics, mixpanel } = load({ sandbox: true })
    analytics.initAnalytics()
    expect(mixpanel.init).not.toHaveBeenCalled()
  })
})

describe('identifyAnalyticsUser and setAnalyticsGroups', () => {
  const user = { id: '1', name: 'Ada', email: 'ada@example.com', location: 'Somewhere' }
  const memberships = [{ group: { id: '10' } }]
  const group = { id: '10', name: 'Group', location: 'Here', type: null }

  it('sends the profile and groups when analytics are allowed', () => {
    const { analytics, mixpanel } = load()
    analytics.identifyAnalyticsUser(user, null)
    analytics.setAnalyticsGroups(memberships, group, null)
    expect(mixpanel.identify).toHaveBeenCalledWith('1')
    expect(mixpanel.people.set).toHaveBeenCalledWith({ $name: 'Ada', $email: 'ada@example.com', $location: 'Somewhere' })
    expect(mixpanel.set_group).toHaveBeenCalledWith('groupId', ['10'])
  })

  it.each([
    ['analytics were rejected', false],
    ['the choice is not known yet', undefined]
  ])('sends nothing when %s', (_, choice) => {
    const { analytics, mixpanel } = load()
    analytics.identifyAnalyticsUser(user, choice)
    analytics.setAnalyticsGroups(memberships, group, choice)
    expect(mixpanel.identify).not.toHaveBeenCalled()
    expect(mixpanel.people.set).not.toHaveBeenCalled()
    expect(mixpanel.set_group).not.toHaveBeenCalled()
    expect(mixpanel.get_group).not.toHaveBeenCalled()
  })
})

describe('when the choice changes before CookieConsentProvider applies it', () => {
  const user = { id: '1', name: 'Ada', email: 'ada@example.com', location: 'Somewhere' }
  const memberships = [{ group: { id: '10' } }]

  // Like the real SDK, drops profile and group calls while opted out
  function trackOptOut (mixpanel, optedOut) {
    const sent = []
    mixpanel.has_opted_out_tracking.mockImplementation(() => optedOut)
    mixpanel.opt_out_tracking.mockImplementation(() => { optedOut = true })
    mixpanel.opt_in_tracking.mockImplementation(() => { optedOut = false })
    mixpanel.people.set.mockImplementation(props => { if (!optedOut) sent.push(props) })
    mixpanel.set_group.mockImplementation((key, ids) => { if (!optedOut) sent.push(ids) })
    return sent
  }

  it('opts back in before sending when analytics are accepted after a rejection', () => {
    const { analytics, mixpanel } = load({ consent: { analytics: false, support: false } })
    const sent = trackOptOut(mixpanel, false)
    analytics.initAnalytics()

    analytics.identifyAnalyticsUser(user, true)
    analytics.setAnalyticsGroups(memberships, null, true)

    expect(mixpanel.opt_in_tracking).toHaveBeenCalledTimes(1)
    expect(sent).toEqual([{ $name: 'Ada', $email: 'ada@example.com', $location: 'Somewhere' }, ['10']])
  })

  it('opts out when the rejection is known only from the account', () => {
    const { analytics, mixpanel } = load()
    const sent = trackOptOut(mixpanel, false)
    analytics.initAnalytics()

    analytics.identifyAnalyticsUser(user, false)
    analytics.setAnalyticsGroups(memberships, null, false)

    expect(mixpanel.opt_out_tracking).toHaveBeenCalledWith({ delete_user: false })
    expect(mixpanel.identify).not.toHaveBeenCalled()
    expect(sent).toEqual([])
  })
})
