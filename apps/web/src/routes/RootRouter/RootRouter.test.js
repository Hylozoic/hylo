import React from 'react'
import { WebViewMessageTypes } from '@hylo/shared'
import { render, waitFor } from 'util/testing/reactTestingLibraryExtended'
import RootRouter, { isNeutralRootSessionLoadingPath } from './RootRouter'

// Use the real WebView bridge (globally mocked) so messages reach window.ReactNativeWebView.
jest.mock('util/webView', () => jest.requireActual('util/webView'))

describe('isNeutralRootSessionLoadingPath', () => {
  it('keeps invitation links on the neutral loading screen while the session loads', () => {
    expect(isNeutralRootSessionLoadingPath('/h/use-invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/h/invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/groups/garden/join/join-code')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/invite/join-code')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/view/join-code')).toBe(true)
  })

  it('uses the app shell for main app paths', () => {
    expect(isNeutralRootSessionLoadingPath('/groups/garden')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h/invitation/extra')).toBe(false)
  })
})

describe('RootRouter in the v2 mobile WebView', () => {
  let postMessage

  // The default msw handler answers CheckLogin with `{ data: {} }`, i.e. no `me`:
  // the WebView's session cookie isn't being accepted.
  const sentTypes = () => postMessage.mock.calls.map(([message]) => JSON.parse(message).type)
  const sendSessionReady = () => window.dispatchEvent(
    new window.MessageEvent('message', { data: JSON.stringify({ type: WebViewMessageTypes.SESSION_READY }) })
  )

  beforeEach(() => {
    window.localStorage.clear()
    postMessage = jest.fn()
    window.ReactNativeWebView = { postMessage }
    window.HyloMobileV2 = true
  })

  afterEach(() => {
    delete window.ReactNativeWebView
    delete window.HyloMobileV2
    window.localStorage.clear()
  })

  it('counts each SESSION_READY retry that is still anonymous, then asks native to log out (#1711)', async () => {
    render(<RootRouter />)

    await waitFor(() => expect(sentTypes()).toEqual([WebViewMessageTypes.VERIFY_AUTH]))

    // Android doesn't reload the page when native re-mints the cookie, so the retry
    // happens in place via SESSION_READY. It must still count as an attempt.
    sendSessionReady()
    await waitFor(() => expect(sentTypes()).toHaveLength(2))
    sendSessionReady()
    await waitFor(() => expect(sentTypes()).toHaveLength(3))
    sendSessionReady()
    await waitFor(() => expect(sentTypes()).toHaveLength(4))

    expect(sentTypes()).toEqual([
      WebViewMessageTypes.VERIFY_AUTH,
      WebViewMessageTypes.VERIFY_AUTH,
      WebViewMessageTypes.VERIFY_AUTH,
      WebViewMessageTypes.LOGOUT
    ])
    // Cleared so the next launch doesn't start in recovery.
    expect(window.localStorage.getItem('hyloMobileRecovering')).toBeNull()
    expect(window.localStorage.getItem('hyloMobileReauthAttempts')).toBeNull()
  })
})
