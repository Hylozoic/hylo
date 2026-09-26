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

describe('analyticsAllowed', () => {
  it.each([
    ['nobody has answered the cookie panel', {}, true],
    ['analytics were accepted', { consent: { analytics: true, support: true } }, true],
    ['analytics were rejected', { consent: { analytics: false, support: true } }, false],
    ['in the sandbox', { sandbox: true }, false],
    ['without a Mixpanel token', { token: '' }, false]
  ])('when %s', (_, options, expected) => {
    const { analytics } = load(options)
    expect(analytics.analyticsAllowed()).toBe(expected)
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
    analytics.identifyAnalyticsUser(user)
    analytics.setAnalyticsGroups(memberships, group)
    expect(mixpanel.identify).toHaveBeenCalledWith('1')
    expect(mixpanel.people.set).toHaveBeenCalledWith({ $name: 'Ada', $email: 'ada@example.com', $location: 'Somewhere' })
    expect(mixpanel.set_group).toHaveBeenCalledWith('groupId', ['10'])
  })

  it('sends nothing when analytics were rejected', () => {
    const { analytics, mixpanel } = load({ consent: { analytics: false, support: true } })
    analytics.identifyAnalyticsUser(user)
    analytics.setAnalyticsGroups(memberships, group)
    expect(mixpanel.identify).not.toHaveBeenCalled()
    expect(mixpanel.people.set).not.toHaveBeenCalled()
    expect(mixpanel.set_group).not.toHaveBeenCalled()
    expect(mixpanel.get_group).not.toHaveBeenCalled()
  })
})
