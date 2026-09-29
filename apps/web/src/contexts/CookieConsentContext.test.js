import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { applyAnalyticsConsent } from 'util/analytics'
import { createCookieConsentData, getCookieConsent, shouldSkipCookieConsent, validateCookieConsent } from 'util/cookieConsent'
import { CookieConsentProvider, useCookieConsent } from './CookieConsentContext'

jest.mock('util/analytics', () => ({
  applyAnalyticsConsent: jest.fn()
}))

jest.mock('hooks/useCurrentUser', () => ({
  useCurrentUser: jest.fn(() => ({ id: '1', cookieConsentPreferences: null }))
}))

function renderConsent () {
  const wrapper = ({ children }) => <CookieConsentProvider>{children}</CookieConsentProvider>
  return renderHook(() => useCookieConsent(), { wrapper })
}

describe('CookieConsentProvider and Mixpanel', () => {
  beforeEach(() => {
    applyAnalyticsConsent.mockClear()
    createCookieConsentData.mockImplementation(settings => ({
      id: 'consent-1',
      analytics: settings.analytics || false,
      support: settings.support || false,
      isLinkedToUser: true,
      lastUpdated: '2026-09-28T00:00:00.000Z'
    }))
  })

  afterEach(() => {
    createCookieConsentData.mockImplementation(() => ({}))
    shouldSkipCookieConsent.mockImplementation(() => true)
    getCookieConsent.mockImplementation(() => null)
    validateCookieConsent.mockImplementation(() => false)
  })

  it('marks a rejection made in the panel as explicit, so the profile is deleted', async () => {
    const { result } = renderConsent()
    await act(async () => {
      await result.current.updateCookieConsent({ analytics: false, support: true })
    })
    expect(applyAnalyticsConsent).toHaveBeenCalledWith(
      expect.objectContaining({ analytics: false }),
      { explicit: true }
    )
  })

  it('replays a stored choice without marking it explicit', async () => {
    const stored = { id: 'consent-2', analytics: false, support: false, isLinkedToUser: false, lastUpdated: '2026-09-01T00:00:00.000Z' }
    shouldSkipCookieConsent.mockImplementation(() => false)
    getCookieConsent.mockImplementation(() => stored)
    validateCookieConsent.mockImplementation(() => true)

    const { result } = renderConsent()
    await act(async () => {})

    expect(result.current.cookieData).toEqual(stored)
    expect(applyAnalyticsConsent).toHaveBeenCalledWith(stored)
    for (const call of applyAnalyticsConsent.mock.calls) {
      expect(call[1]).toBeUndefined()
    }
  })
})
