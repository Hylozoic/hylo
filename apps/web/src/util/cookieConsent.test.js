const {
  getCookieConsent,
  updateCookieFromDatabase,
  validateCookieConsent
} = jest.requireActual('util/cookieConsent')

const CONSENT_ID = '11111111-1111-4111-8111-111111111111'

function clearConsentCookie () {
  document.cookie = 'hylo_cookie_consent=; path=/; max-age=0'
}

describe('updateCookieFromDatabase', () => {
  beforeEach(() => {
    clearConsentCookie()
  })

  afterEach(() => {
    clearConsentCookie()
  })

  it('restores the account consent uuid and saved choices into the browser cookie', () => {
    const saved = updateCookieFromDatabase({
      id: '9',
      consentId: CONSENT_ID,
      userId: '42',
      settings: { analytics: false, support: true },
      updatedAt: '2024-01-02T00:00:00.000Z'
    })

    const cookie = getCookieConsent()

    expect(saved).toBe(true)
    expect(cookie.id).toBe(CONSENT_ID)
    expect(cookie.analytics).toBe(false)
    expect(cookie.support).toBe(true)
    expect(cookie.isLinkedToUser).toBe(true)
    expect(cookie.userId).toBe('42')
    expect(validateCookieConsent(cookie)).toBe(true)
  })
})
