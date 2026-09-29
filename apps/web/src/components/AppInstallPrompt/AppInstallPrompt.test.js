import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { AuthSessionStatus } from 'store/reducers/authSession'
import AppInstallPrompt, { DISMISS_STORAGE_KEY, shouldShowAppInstallPrompt } from './AppInstallPrompt'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(eventName => ({ type: 'TRACK_ANALYTICS_EVENT', meta: { analytics: { eventName } } })))

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const base = {
  userAgent: ANDROID_CHROME,
  inWebView: false,
  signupComplete: true,
  membershipCount: 1,
  dismissed: false,
  pathname: '/groups/garden/stream'
}

describe('shouldShowAppInstallPrompt', () => {
  it('shows in an Android browser once signup is done and the person is in a group', () => {
    expect(shouldShowAppInstallPrompt(base)).toBe(true)
  })

  it('never shows inside the app, in another app WebView, or off Android', () => {
    expect(shouldShowAppInstallPrompt({ ...base, inWebView: true })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, userAgent: ANDROID_WEBVIEW })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, userAgent: IPHONE })).toBe(false)
  })

  it('waits for signup to finish and a first group', () => {
    expect(shouldShowAppInstallPrompt({ ...base, signupComplete: false })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, membershipCount: 0 })).toBe(false)
  })

  it('stays out of the way mid-flow and after dismissal', () => {
    expect(shouldShowAppInstallPrompt({ ...base, pathname: '/signup/finish' })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, pathname: '/groups/garden/join/abc123' })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, pathname: '/groups/garden/welcome' })).toBe(false)
    expect(shouldShowAppInstallPrompt({ ...base, dismissed: true })).toBe(false)
  })
})

describe('AppInstallPrompt', () => {
  function providers ({ signupInProgress = false, memberships = 1 } = {}) {
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '1', name: 'Member' })
    session.Group.create({ id: '9', slug: 'garden', name: 'Garden' })
    if (memberships > 0) session.Membership.create({ id: '5', person: '1', group: '9' })
    return AllTheProviders({
      orm: session.state,
      authSession: {
        status: AuthSessionStatus.Authenticated,
        emailValidated: true,
        hasRegistered: true,
        signupInProgress
      }
    })
  }

  beforeEach(() => {
    window.localStorage.removeItem(DISMISS_STORAGE_KEY)
    trackAnalyticsEvent.mockClear()
  })

  it('offers Open in app and Install, and remembers a dismissal', () => {
    render(<AppInstallPrompt userAgent={ANDROID_CHROME} />, { wrapper: providers() })
    expect(screen.getByTestId('app-install-prompt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.hylo.hyloandroid')
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('App Install Prompt Shown')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('app-install-prompt')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBeTruthy()
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('App Install Prompt Dismissed')
  })

  it('does not show while signup is still in progress', () => {
    render(<AppInstallPrompt userAgent={ANDROID_CHROME} />, { wrapper: providers({ signupInProgress: true }) })
    expect(screen.queryByTestId('app-install-prompt')).not.toBeInTheDocument()
  })

  it('does not show before the person joins a group', () => {
    render(<AppInstallPrompt userAgent={ANDROID_CHROME} />, { wrapper: providers({ memberships: 0 }) })
    expect(screen.queryByTestId('app-install-prompt')).not.toBeInTheDocument()
  })

  it('sits under the post composer, so its Post button is never covered', () => {
    // .create-modal in components/CreatePostModal/CreatePostModal.module.scss
    const POST_COMPOSER_Z = 70
    render(<AppInstallPrompt userAgent={ANDROID_CHROME} />, { wrapper: providers() })
    const zIndex = Number(screen.getByTestId('app-install-prompt').className.match(/\bz-\[(\d+)\]/)?.[1])
    expect(zIndex).toBeLessThan(POST_COMPOSER_Z)
  })

  it('does not show on iPhone', () => {
    render(<AppInstallPrompt userAgent={IPHONE} />, { wrapper: providers() })
    expect(screen.queryByTestId('app-install-prompt')).not.toBeInTheDocument()
  })

  it('keeps working when storage is unavailable', () => {
    const getItem = jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => render(<AppInstallPrompt userAgent={ANDROID_CHROME} />, { wrapper: providers() })).not.toThrow()
    getItem.mockRestore()
  })
})
