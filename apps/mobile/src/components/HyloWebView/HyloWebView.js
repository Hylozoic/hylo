import React, { useCallback, useState, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import Config from 'react-native-config'
import useRouteParams from 'hooks/useRouteParams'
import AutoHeightWebView from 'react-native-autoheight-webview'
import { getSessionCookie, clearSessionCookie, ensureWebViewCookies } from 'util/session'
import { parseWebViewMessage } from '.'
import { useAuth } from '@hylo/contexts/AuthContext'

/* Should probably just be applied to Hylo Web stylesheet 
  as what this solves is not necessarily WebView specific, 
  but putting here for now to limit possible untested impact
  on Hylo Web generally */
const baseCustomStyle = `
  ::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  html, body {
    overflow: hidden;
    overflow-y: hidden;
    overflow-x: hidden;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  
  body {
    width: 100vw !important;
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    max-width: 100% !important;
  }
`

const HyloWebView = React.forwardRef(({
  messageHandler,
  path: pathProp,
  style,
  source,
  customStyle: providedCustomStyle = '',
  enableScrolling = false,
  ...forwardedProps
}, webViewRef) => {
  const [cookie, setCookie] = useState()
  const [isLoading, setIsLoading] = useState(true)
  const [showSessionRecovery, setShowSessionRecovery] = useState(false)
  const { postId, path: routePath, originalLinkingPath } = useRouteParams()
  const path = pathProp || routePath || originalLinkingPath || ''
  const uri = (source?.uri || `${Config.HYLO_WEB_BASE_URL}${path}`) + (postId ? `?postId=${postId}` : '')
  const { isAuthenticated, logout } = useAuth()

  // Debug logging for webview URI construction
  if (__DEV__) {
    console.log('🔍 HyloWebView URI Debug:', {
      pathProp,
      routePath,
      originalLinkingPath,
      resolvedPath: path,
      baseUrl: Config.HYLO_WEB_BASE_URL,
      finalUri: uri,
      postId
    })
  }

  const customStyle = `${baseCustomStyle}${providedCustomStyle}`

  // Monitor auth state changes and reset recovery state when auth is restored
  useEffect(() => {
    if (isAuthenticated) {
      setShowSessionRecovery(false)
    }
  }, [isAuthenticated])

  // Brief debounce before triggering logout when no cookie is found,
  // to avoid acting on transient states during focus transitions.
  useEffect(() => {
    let timer
    if (!cookie && !isLoading) {
      timer = setTimeout(() => {
        setShowSessionRecovery(true)
      }, 2000)
    } else {
      setShowSessionRecovery(false)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [cookie, isLoading])

  // Clear error state when component re-focuses
  useFocusEffect(
    useCallback(() => {
      const getCookieAsync = async () => {
        try {
          const newCookie = await getSessionCookie()
          // Populate the WebView's native cookie jar BEFORE calling setCookie().
          // setCookie() makes `cookie` truthy which immediately renders the WebView
          // and starts loading. If we populate the jar after, there's a race where
          // the web app mounts and fires XHR calls before the Android CookieManager
          // has the session cookie, causing a 401 → redirect → ONE visible restart.
          // sharedCookiesEnabled is iOS-only so this is especially important on Android.
          if (newCookie) {
            await ensureWebViewCookies()
          }
          setCookie(newCookie)
        } catch (error) {
          // Cookie retrieval failed - will trigger native logout after debounce
          console.error('Cookie retrieval failed', error)
        }
      }
      getCookieAsync()
    }, [])
  )



  // WebView event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true)
  }, [])

  const handleLoadEnd = useCallback((event) => {
    setIsLoading(false)
  }, [])

  const handleMessage = message => {
    const parsedMessage = parseWebViewMessage(message)
    const { type } = parsedMessage

    if (__DEV__ && type) {
      console.log('📱 Unhandled WebView message type:', type)
    }

    messageHandler && messageHandler(parsedMessage)
  }


  // No session cookie means the native session is out of sync with the WebView.
  // Trigger logout immediately so native handles navigation to its login screens.
  // We never want to show a web-side recovery UI inside the mobile app.
  if (!cookie || !uri) {
    if (showSessionRecovery) {
      clearSessionCookie().then(() => logout()).catch(() => logout())
    }
    return null
  }

  return (
    <AutoHeightWebView
      // Must run before page JS so window.HyloMobileV2 is visible when the web app's
      // router initialises. Must end with `true` to avoid an Android WebView crash.
      injectedJavaScriptBeforeContentLoaded='window.HyloWebView=true;window.HyloMobileV2=true;true;'
      customScript=''
      customStyle={customStyle}
      geolocationEnabled
      onMessage={handleMessage}
      nestedScrollEnabled
      hideKeyboardAccessoryView
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      originWhitelist={[
        'https://www.hylo*',
        'https://staging.hylo*',
        'http://localhost*',
        'https://www.youtube.com',
        'https://*.youtube.com',
        'https://*.vimeo.com',
        'https://*.soundcloud.com'
      ]}
      ref={webViewRef}
      scalesPageToFit={false}
      // AutoHeight requires scrollEnabled={false}
      // Full-screen WebViews should set enableScrolling={true} for pull-to-refresh
      scrollEnabled={enableScrolling}
      setSupportMultipleWindows={false}
      sharedCookiesEnabled
      source={{
        uri,
        headers: { cookie, 'X-Hylo-Mobile': 'v2' }
      }}
      // DEPRECATED: Native pull-to-refresh doesn't work with AutoHeightWebView
      // AutoHeightWebView manages its own height and scrolling happens inside the WebView
      // (via CSS/JS), so the native layer can't detect scroll position.
      // Pull-to-refresh is now handled on the web side via usePullToRefresh hook.
      // pullToRefreshEnabled={enablePullToRefresh && enableScrolling}
      // onRefresh={enablePullToRefresh && enableScrolling ? handleRefresh : undefined}
      // refreshing={refreshing}
      style={[style, {
        // Avoids a known issue which can cause Android crashes
        // ref. https://github.com/iou90/react-native-autoheight-webview/issues/191
        opacity: 0.99,
        minHeight: 1,
        width: '100%' // Ensure the WebView takes full width
      }]}
      // Recommended setting from AutoHeightWebView docs, with disclaimer about a
      // potential Android issue. It helpfully disables iOS zoom feature.
      viewportContent='width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1'
      {...forwardedProps}
    />
  )
})

export default HyloWebView
