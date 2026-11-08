import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const sentryScript = '(function(){/* sentry-trace meta */})();\ntrue;'
const mockSentryWebViewProps = jest.fn((_options: { allowedHosts: string[] }) => ({
  injectedJavaScriptBeforeContentLoaded: sentryScript,
  onMessage: () => {}
}))

jest.mock('react-native-url-polyfill', () => ({ URL }))
jest.mock('@sentry/react-native', () => ({
  sentryWebViewProps: (options: { allowedHosts: string[] }) => mockSentryWebViewProps(options)
}))

import { buildInjectedJavaScriptBeforeContentLoaded, sentryAllowedHosts } from './injectedScripts'

function runInFakeWindow (script: string): Record<string, unknown> {
  const fakeWindow: Record<string, unknown> = {}
  new Function('window', script)(fakeWindow)
  return fakeWindow
}

describe('WebView injected scripts', () => {
  beforeEach(() => {
    mockSentryWebViewProps.mockClear()
  })

  it('keeps the Hylo setup and appends the Sentry trace script', () => {
    const script = buildInjectedJavaScriptBeforeContentLoaded({
      mobileAppVersion: ' 7.1.0 ',
      nativeSessionId: 'session-1',
      webBaseUrl: 'https://www.hylo.com'
    })

    expect(script.startsWith('window.HyloMobileAppVersion="7.1.0";')).toBe(true)
    expect(script.endsWith(`\n${sentryScript}`)).toBe(true)
    expect(runInFakeWindow(script)).toEqual({
      HyloMobileAppVersion: '7.1.0',
      HyloNativeSessionId: 'session-1',
      HyloWebView: true,
      HyloMobileV2: true
    })
  })

  it('only passes Hylo hosts to Sentry', () => {
    buildInjectedJavaScriptBeforeContentLoaded({ nativeSessionId: 's', webBaseUrl: 'http://localhost:3000' })
    expect(mockSentryWebViewProps).toHaveBeenCalledWith({ allowedHosts: ['hylo.com', 'localhost'] })
  })

  it('keeps only the Hylo setup when native Sentry has no trace to inject', () => {
    mockSentryWebViewProps.mockReturnValueOnce({ injectedJavaScriptBeforeContentLoaded: '', onMessage: () => {} })
    const script = buildInjectedJavaScriptBeforeContentLoaded({ nativeSessionId: 's', webBaseUrl: 'https://hylo.com' })
    expect(script).toBe('window.HyloNativeSessionId="s";window.HyloWebView=true;window.HyloMobileV2=true;true;')
  })

  it('derives allowed hosts from the configured web URL without adding third parties', () => {
    expect(sentryAllowedHosts('https://www.hylo.com')).toEqual(['hylo.com'])
    expect(sentryAllowedHosts('https://staging.hylo.com')).toEqual(['hylo.com'])
    expect(sentryAllowedHosts('https://hylo.com')).toEqual(['hylo.com'])
    expect(sentryAllowedHosts('http://192.168.1.20:3000')).toEqual(['hylo.com', '192.168.1.20'])
    expect(sentryAllowedHosts('not a url')).toEqual(['hylo.com'])
  })
})
