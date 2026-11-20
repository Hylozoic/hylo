import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { get } from 'lodash/fp'
import orm from 'store/models'
import { CHECK_LOGIN } from 'store/constants'
import { AuthSessionStatus } from 'store/reducers/authSession'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import {
  shouldSkipCookieConsent,
  getCookieConsent,
  validateCookieConsent,
  updateCookieFromDatabase
} from 'util/cookieConsent'
import { CookieConsentProvider, useCookieConsent } from './CookieConsentContext'

const SAVED_CONSENT = {
  id: '9',
  consentId: '11111111-1111-4111-8111-111111111111',
  userId: '1',
  settings: { analytics: false, support: true },
  version: '1.0',
  updatedAt: '2024-01-02T00:00:00.000Z'
}

function BannerProbe () {
  const { showPreferencesPanel, isInitialized } = useCookieConsent()
  if (!isInitialized) return <div>loading</div>
  return <div>{showPreferencesPanel ? 'banner-visible' : 'banner-hidden'}</div>
}

function authState (status, me) {
  const session = orm.session(JSON.parse(JSON.stringify(orm.getEmptyState())))
  if (me) session.Me.create(me)

  return {
    orm: session.state,
    authSession: {
      status,
      userId: me?.id || null,
      emailValidated: me ? true : null,
      hasRegistered: me ? true : null,
      signupInProgress: null,
      checkedAt: status === AuthSessionStatus.Unknown ? null : Date.now()
    }
  }
}

function renderConsent (state) {
  const store = generateStore(state)
  render(
    <Provider store={store}>
      <CookieConsentProvider>
        <BannerProbe />
      </CookieConsentProvider>
    </Provider>
  )
  return store
}

describe('CookieConsentProvider', () => {
  beforeEach(() => {
    shouldSkipCookieConsent.mockReturnValue(false)
    getCookieConsent.mockReset()
    getCookieConsent.mockReturnValue(null)
    validateCookieConsent.mockReset()
    validateCookieConsent.mockReturnValue(false)
    updateCookieFromDatabase.mockReset()
    updateCookieFromDatabase.mockReturnValue(false)
  })

  it('shows the banner for a logged-out visitor with no saved choice', async () => {
    renderConsent(authState(AuthSessionStatus.Anonymous))

    expect(await screen.findByText('banner-visible')).toBeInTheDocument()
  })

  it('waits to show the banner until the session check finishes', async () => {
    renderConsent(authState(AuthSessionStatus.Unknown))

    expect(await screen.findByText('banner-hidden')).toBeInTheDocument()
  })

  it('hides the banner after login when the account already has a choice', async () => {
    updateCookieFromDatabase.mockReturnValue(true)
    const store = renderConsent(authState(AuthSessionStatus.Anonymous))

    expect(await screen.findByText('banner-visible')).toBeInTheDocument()

    await act(async () => {
      store.dispatch({
        type: CHECK_LOGIN,
        payload: {
          data: {
            me: {
              id: '1',
              name: 'Ada',
              emailValidated: true,
              hasRegistered: true,
              cookieConsentPreferences: SAVED_CONSENT
            }
          }
        },
        meta: {
          extractModel: [{
            getRoot: get('me'),
            modelName: 'Me'
          }]
        }
      })
    })

    expect(await screen.findByText('banner-hidden')).toBeInTheDocument()
    expect(updateCookieFromDatabase).toHaveBeenCalledWith(expect.objectContaining({
      consentId: SAVED_CONSENT.consentId,
      settings: SAVED_CONSENT.settings
    }), true)
  })

  it('keeps the banner hidden when this browser already has a valid consent cookie', async () => {
    getCookieConsent.mockReturnValue({
      id: SAVED_CONSENT.consentId,
      analytics: false,
      support: true,
      isLinkedToUser: true,
      lastUpdated: SAVED_CONSENT.updatedAt
    })
    validateCookieConsent.mockReturnValue(true)

    renderConsent(authState(AuthSessionStatus.Anonymous))

    expect(await screen.findByText('banner-hidden')).toBeInTheDocument()
    expect(updateCookieFromDatabase).not.toHaveBeenCalled()
  })
})
