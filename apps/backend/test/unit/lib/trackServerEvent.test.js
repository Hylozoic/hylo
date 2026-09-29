/* eslint-disable no-unused-expressions */
const { v4: uuidv4 } = require('uuid')
const rootPath = require('root-path')
const setup = require(rootPath('test/setup'))
const factories = require(rootPath('test/setup/factories'))
const mixpanel = require(rootPath('lib/mixpanel'))
const {
  browserAnalyticsChoice,
  requestPlatform,
  trackServerEvent,
  trackServerEventForUsers
} = require(rootPath('lib/analytics/trackServerEvent'))

// Saves a consent record with an explicit creation time, so "latest" is unambiguous
function saveConsent (user, analytics, minutesAgo = 0) {
  return bookshelf.knex('cookie_consents').insert({
    consent_id: uuidv4(),
    user_id: user.id,
    settings: JSON.stringify({ analytics, support: true }),
    version: '1.0',
    created_at: new Date(Date.now() - minutesAgo * 60000),
    updated_at: new Date(Date.now() - minutesAgo * 60000)
  })
}

function consentCookie (analytics) {
  return JSON.stringify({ id: uuidv4(), analytics, support: true, isLinkedToUser: false, lastUpdated: new Date().toISOString() })
}

describe('trackServerEvent', () => {
  let accepted, rejected, unanswered, changedMind, saved

  before(async () => {
    await setup.clearDb()
    accepted = await factories.user().save()
    rejected = await factories.user().save()
    unanswered = await factories.user().save()
    changedMind = await factories.user().save()
    await saveConsent(accepted, true)
    await saveConsent(rejected, false)
    await saveConsent(changedMind, true, 60)
    await saveConsent(changedMind, false, 5)
  })

  beforeEach(() => {
    saved = { disabled: mixpanel.disabled, track: mixpanel.track }
    mixpanel.disabled = false
    mixpanel.track = spy(() => {})
  })

  afterEach(() => {
    mixpanel.disabled = saved.disabled
    mixpanel.track = saved.track
  })

  const sentTo = () => mixpanel.track.__spy.calls.map(([, props]) => props.distinct_id)

  it('sends the event for someone who accepted analytics', async () => {
    const sent = await trackServerEvent(accepted.id, 'Test Event', { platform: 'Web' })
    expect(sent).to.be.true
    expect(mixpanel.track).to.have.been.called.with('Test Event', { platform: 'Web', distinct_id: String(accepted.id) })
  })

  it('sends the event for someone who never answered', async () => {
    expect(await trackServerEvent(unanswered.id, 'Test Event')).to.be.true
    expect(sentTo()).to.deep.equal([String(unanswered.id)])
  })

  it('sends nothing for someone who rejected analytics', async () => {
    expect(await trackServerEvent(rejected.id, 'Test Event')).to.be.false
    expect(mixpanel.track).not.to.have.been.called()
  })

  it('follows the latest saved choice', async () => {
    expect(await trackServerEvent(changedMind.id, 'Test Event')).to.be.false
    expect(mixpanel.track).not.to.have.been.called()
  })

  it("respects a rejection in the requester's browser before one is saved on the account", async () => {
    const req = { cookies: { hylo_cookie_consent: consentCookie(false) }, headers: {} }
    expect(await trackServerEvent(unanswered.id, 'Test Event', {}, { req })).to.be.false
    expect(mixpanel.track).not.to.have.been.called()
  })

  it('does not let a browser acceptance override a rejection saved on the account', async () => {
    const req = { cookies: { hylo_cookie_consent: consentCookie(true) }, headers: {} }
    expect(await trackServerEvent(rejected.id, 'Test Event', {}, { req })).to.be.false
    expect(mixpanel.track).not.to.have.been.called()
  })

  it('does nothing when Mixpanel is disabled', async () => {
    mixpanel.disabled = true
    const lookup = CookieConsent.latestAnalyticsChoices
    CookieConsent.latestAnalyticsChoices = spy(lookup)
    try {
      expect(await trackServerEvent(accepted.id, 'Test Event')).to.be.false
      expect(await trackServerEventForUsers([accepted.id], 'Test Event')).to.deep.equal([])
      expect(mixpanel.track).not.to.have.been.called()
      expect(CookieConsent.latestAnalyticsChoices).not.to.have.been.called()
    } finally {
      CookieConsent.latestAnalyticsChoices = lookup
    }
  })

  it('never throws when the event cannot be sent', async () => {
    mixpanel.track = spy(() => { throw new Error('network down') })
    expect(await trackServerEvent(accepted.id, 'Test Event')).to.be.false
  })

  describe('for many users at once', () => {
    it('looks up consent once and sends only to people who have not rejected analytics', async () => {
      const lookup = CookieConsent.latestAnalyticsChoices
      CookieConsent.latestAnalyticsChoices = spy(lookup)
      try {
        const sent = await trackServerEventForUsers(
          [accepted.id, rejected.id, unanswered.id, changedMind.id, accepted.id],
          'Test Event',
          id => ({ groupId: ['7'], who: id })
        )
        expect(CookieConsent.latestAnalyticsChoices).to.have.been.called.once
        expect(sent).to.deep.equal([String(accepted.id), String(unanswered.id)])
        expect(sentTo()).to.deep.equal([String(accepted.id), String(unanswered.id)])
        expect(mixpanel.track).to.have.been.called.with('Test Event', { groupId: ['7'], who: String(accepted.id), distinct_id: String(accepted.id) })
      } finally {
        CookieConsent.latestAnalyticsChoices = lookup
      }
    })

    it('does nothing for an empty list', async () => {
      expect(await trackServerEventForUsers([], 'Test Event')).to.deep.equal([])
      expect(mixpanel.track).not.to.have.been.called()
    })
  })
})

describe('CookieConsent.latestAnalyticsChoices', () => {
  it('returns each answered user\'s latest choice and leaves out people who never answered', async () => {
    await setup.clearDb()
    const [a, b, c] = await Promise.all([factories.user().save(), factories.user().save(), factories.user().save()])
    await saveConsent(a, false, 30)
    await saveConsent(a, true, 1)
    await saveConsent(b, false)
    const choices = await CookieConsent.latestAnalyticsChoices([a.id, b.id, c.id])
    expect(choices.get(String(a.id))).to.equal(true)
    expect(choices.get(String(b.id))).to.equal(false)
    expect(choices.has(String(c.id))).to.be.false
  })
})

describe('browserAnalyticsChoice and requestPlatform', () => {
  it('reads the consent cookie and ignores anything unreadable', () => {
    expect(browserAnalyticsChoice({ cookies: { hylo_cookie_consent: consentCookie(false) } })).to.equal(false)
    expect(browserAnalyticsChoice({ cookies: { hylo_cookie_consent: consentCookie(true) } })).to.equal(true)
    expect(browserAnalyticsChoice({ cookies: { hylo_cookie_consent: 'not json' } })).to.be.undefined
    expect(browserAnalyticsChoice({ cookies: {} })).to.be.undefined
    expect(browserAnalyticsChoice(undefined)).to.be.undefined
  })

  it('reports the app the request came from', () => {
    expect(requestPlatform({ headers: { 'ios-version': '5.0' } })).to.equal('ios')
    expect(requestPlatform({ headers: { 'android-version': '5.0' } })).to.equal('android')
    expect(requestPlatform({ headers: {} })).to.equal('Web')
  })
})
