import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import { StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { WebView } from 'react-native-webview'
import type { WebViewProps } from 'react-native-webview'
import { useAuth } from '@hylo/contexts/AuthContext'
import { WebViewMessageTypes } from '@hylo/shared'
import { HYLO_WEB_BASE_URL } from 'config'
import useRouteParams from 'hooks/useRouteParams'
import {
  clearSessionCookie,
  ensureWebViewCookies,
  getSessionCookie,
  joinWebBaseAndPath,
  sessionCookieFromToken,
  webViewOriginWhitelist
} from 'util/session'
import { authLog, authHandshakeEvent } from 'util/authDebug'
import getNativeSessionId from 'util/nativeSessionId'
import { parseWebViewMessage } from './parseWebViewMessage'
import { sendMessageFromWebView } from './sendMessageFromWebView'

const baseInjectedStyle = `
  ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  html, body { overflow: hidden; width: 100%; margin: 0; padding: 0; }
  body { width: 100vw !important; position: fixed !important; left: 0 !important; right: 0 !important; max-width: 100% !important; }
`

type HyloWebViewProps = Omit<WebViewProps, 'source' | 'onMessage'> & {
  messageHandler?: (message: { type: string, data?: unknown }) => void
  path?: string
  mobileAppVersion?: string
  enableScrolling?: boolean
  onSessionRecoveryStart?: () => void
  onSessionRecoveryEnd?: () => void
  onCookieStateChange?: (isResolving: boolean) => void
}

const HyloWebView = forwardRef<WebView, HyloWebViewProps>(function HyloWebView (
  {
    messageHandler,
    path: pathProp,
    style,
    source,
    mobileAppVersion,
    enableScrolling = false,
    onLoadStart: externalOnLoadStart,
    onLoadEnd: externalOnLoadEnd,
    onSessionRecoveryStart,
    onSessionRecoveryEnd,
    onCookieStateChange,
    ...forwardedProps
  },
  webViewRef
) {
  const [cookie, setCookie] = useState<string | null | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [showSessionRecovery, setShowSessionRecovery] = useState(false)
  const { postId, path: routePath, originalLinkingPath } = useRouteParams()
  const path = pathProp || routePath || originalLinkingPath || ''
  const baseUri = source?.uri || joinWebBaseAndPath(HYLO_WEB_BASE_URL, path)
  const shouldAppendPostId = postId && !baseUri.includes('postId=')
  const uri = shouldAppendPostId
    ? `${baseUri}${baseUri.includes('?') ? '&' : '?'}postId=${postId}`
    : baseUri
  const { isAuthenticated, logout } = useAuth()

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    const trimmed = mobileAppVersion != null ? String(mobileAppVersion).trim() : ''
    const versionLine = trimmed !== ''
      ? `window.HyloMobileAppVersion=${JSON.stringify(trimmed)};`
      : ''
    const sessionIdLine = `window.HyloNativeSessionId=${JSON.stringify(getNativeSessionId())};`
    const webBootLine = '(function(){try{if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:\'WEB_BOOT\',data:{phase:\'flags\'}}));}}catch(e){}})();'
    return `${versionLine}${sessionIdLine}window.HyloWebView=true;window.HyloMobileV2=true;${webBootLine}true;`
  }, [mobileAppVersion])

  const injectedJavaScript = useMemo(() => {
    return `(function(){var s=document.createElement('style');s.innerHTML=${JSON.stringify(baseInjectedStyle)};document.head.appendChild(s);})();true;`
  }, [])

  useEffect(() => {
    if (isAuthenticated) setShowSessionRecovery(false)
  }, [isAuthenticated])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!cookie && !isLoading) {
      timer = setTimeout(() => setShowSessionRecovery(true), 2000)
    } else {
      setShowSessionRecovery(false)
    }
    return () => { if (timer) clearTimeout(timer) }
  }, [cookie, isLoading])

  useEffect(() => {
    onCookieStateChange?.(cookie === undefined)
  }, [cookie, onCookieStateChange])

  useFocusEffect(
    useCallback(() => {
      const getCookieAsync = async () => {
        try {
          const fromToken = await sessionCookieFromToken()
          authLog('HyloWebView cookie bridge:', fromToken ? 'token→session ✓' : 'no token, falling back to stored cookie')
          const newCookie = fromToken || await getSessionCookie()
          authLog('HyloWebView final cookie:', newCookie ? `found (${newCookie.slice(0, 30)}…)` : 'none — WebView will not load')
          authHandshakeEvent('WebView cookie bridge', {
            fromToken: !!fromToken,
            hasCookie: !!newCookie
          }, newCookie ? 'info' : 'warning')
          if (newCookie) await ensureWebViewCookies()
          setCookie(newCookie)
          if (!newCookie) setIsLoading(false)
        } catch (error) {
          console.warn('HyloWebView cookie retrieval failed:', error)
          setIsLoading(false)
        }
      }
      getCookieAsync()
    }, [])
  )

  const handleLoadStart = useCallback<NonNullable<WebViewProps['onLoadStart']>>((event) => {
    setIsLoading(true)
    externalOnLoadStart?.(event)
  }, [externalOnLoadStart])

  const handleLoadEnd = useCallback<NonNullable<WebViewProps['onLoadEnd']>>((event) => {
    setIsLoading(false)
    externalOnLoadEnd?.(event)
  }, [externalOnLoadEnd])

  const reverifyAuth = useCallback(async () => {
    onSessionRecoveryStart?.()
    try {
      const fresh = await sessionCookieFromToken()
      if (fresh) {
        await ensureWebViewCookies()
        setCookie(fresh)
        authHandshakeEvent('SESSION_READY sent to web')
        sendMessageFromWebView(webViewRef, WebViewMessageTypes.SESSION_READY)
      } else {
        authHandshakeEvent('reverifyAuth: no cookie after from-token', {}, 'warning')
        onSessionRecoveryEnd?.()
        await clearSessionCookie()
        logout()
      }
    } catch (error) {
      console.warn('HyloWebView re-auth failed:', error)
      authHandshakeEvent('reverifyAuth failed', { message: (error as Error)?.message || String(error) }, 'warning')
      onSessionRecoveryEnd?.()
      logout()
    }
  }, [logout, onSessionRecoveryEnd, onSessionRecoveryStart, webViewRef])

  const handleMessage = useCallback((message: Parameters<NonNullable<WebViewProps['onMessage']>>[0]) => {
    const parsedMessage = parseWebViewMessage(message)
    const { type } = parsedMessage

    if (type === WebViewMessageTypes.VERIFY_AUTH) {
      authLog('HyloWebView VERIFY_AUTH from web — re-minting session')
      authHandshakeEvent('VERIFY_AUTH received from web')
      reverifyAuth()
      return
    }

    if (type === WebViewMessageTypes.AUTH_SUCCESS) {
      authLog('HyloWebView AUTH_SUCCESS from web')
      authHandshakeEvent('AUTH_SUCCESS received from web')
      onSessionRecoveryEnd?.()
      return
    }

    if (type === 'WEB_BOOT') {
      authHandshakeEvent('WEB_BOOT from web', parsedMessage.data || {})
      return
    }

    messageHandler?.(parsedMessage)
  }, [messageHandler, onSessionRecoveryEnd, reverifyAuth])

  if (cookie === undefined && uri) return null

  if (!cookie || !uri) {
    if (showSessionRecovery) {
      clearSessionCookie().then(() => logout()).catch(() => logout())
    }
    return null
  }

  return (
    <WebView
      ref={webViewRef}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
      injectedJavaScript={injectedJavaScript}
      {...forwardedProps}
      geolocationEnabled
      onMessage={handleMessage}
      nestedScrollEnabled
      hideKeyboardAccessoryView
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      originWhitelist={webViewOriginWhitelist(HYLO_WEB_BASE_URL)}
      scalesPageToFit={false}
      scrollEnabled={enableScrolling}
      setSupportMultipleWindows={false}
      sharedCookiesEnabled
      source={{
        uri,
        headers: { cookie, 'X-Hylo-Mobile': 'v2' }
      }}
      style={[styles.webView, style]}
    />
  )
})

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    opacity: 0.99
  }
})

export default HyloWebView
