import React, { useRef, useCallback, useState, useEffect } from 'react'
import { View, StatusBar } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebViewMessageTypes } from '@hylo/shared'
import { isIOS } from 'util/platform'
import HyloWebView from 'components/HyloWebView'
import Loading from 'components/Loading'
import NoInternetConnection from 'screens/NoInternetConnection'
import useLogout from 'hooks/useLogout'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useRouteParams from 'hooks/useRouteParams'
import useNetworkConnectivity from 'hooks/useNetworkConnectivity'
import useThemeStore from 'store/themeStore'

/**
 * PrimaryWebView - Single full-screen WebView for all authenticated content
 * 
 * Replaces the previous architecture of multiple specialized WebView screens:
 * - ChatRoomWebView
 * - GroupSettingsWebView
 * - UserSettingsWebView
 * - MapWebView
 * - GroupExploreWebView
 * 
 * The web app now handles all navigation, UI, and state management.
 * This component handles:
 * 1. Authentication verification (ensures user is logged in)
 * 2. Receiving the route path from deep links / navigation
 * 3. Logout (when web triggers it)
 * 4. Loading states (user auth + WebView content)
 */
export default function PrimaryWebView() {
  const webViewRef = useRef(null)
  const logout = useLogout()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()
  const { backgroundColor, colorScheme, setTheme, hydrate } = useThemeStore()
  const insets = useSafeAreaInsets()

  // Hydrate persisted theme on mount so safe area colors match before WebView loads
  useEffect(() => { hydrate() }, [])

  // On iOS, use a smaller bottom inset since the UI is simple and doesn't need as much space
  const bottomInset = isIOS ? Math.max(insets.bottom * 0.5, 8) : insets.bottom
  const safeAreaEdges = isIOS ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']
  
  // Verify user is authenticated before showing WebView.
  // cache-and-network (not network-only) is intentional: with network-only, any
  // re-execution of this query (e.g. caused by a NetInfo null→false→true flicker)
  // clears currentUser to undefined while the request is in flight, which unmounts
  // the WebView and resets isWebViewLoading — causing the infinite loading loop.
  // cache-and-network keeps stale data available so currentUser stays truthy during re-fetches.
  const currentUserResult = useCurrentUser({
    requestPolicy: 'cache-and-network',
    pause: !isConnected || !isInternetReachable
  })
  const { currentUser, fetching: fetchingUser, error: userError } = currentUserResult?.[0] ?? {}

  // Once we've verified a user, never unmount the WebView due to a re-fetch.
  // If the session truly expires, the web app's RootRouter LOGOUT guard fires instead.
  const hasLoadedUser = useRef(false)
  if (currentUser) hasLoadedUser.current = true
  const [isWebViewLoading, setIsWebViewLoading] = useState(true)
  const [webViewError, setWebViewError] = useState(null)
  
  // Get the path from the route params
  // This comes from the linking table catch-all: ':path(.*)' -> Main
  const { path, originalLinkingPath } = useRouteParams()

  /**
   * Message handler for WebView → Native communication.
   *
   * Handles:
   * - LOGOUT: Trigger native logout flow
   * - THEME_CHANGE: Update native safe-area and status-bar colors to match the web theme
   */
  const messageHandler = useCallback((message) => {
    const { type, data } = message
    
    switch (type) {
      case WebViewMessageTypes.LOGOUT:
        // Web app triggers logout, native handles the actual logout
        console.log('📱 Logout triggered from WebView')
        logout()
        break

      case WebViewMessageTypes.THEME_CHANGE: {
        // Web app changed theme or color scheme — update native safe-area colors
        const { themeName, colorScheme: scheme } = data || {}
        if (themeName && scheme) {
          setTheme(themeName, scheme)
        }
        break
      }
        
      // DEPRECATED: These cases are no longer needed
      // case 'NAVIGATION': Web app handles all navigation now
      // case 'GROUP_DELETED': Web app handles group deletion navigation
      
      default:
        // Log unknown message types in dev for debugging
        if (__DEV__ && type) {
          console.log('📱 Unknown WebView message type:', type, data)
        }
    }
  }, [logout, setTheme])
  
  /**
   * Handle WebView load completion
   */
  const handleLoadEnd = useCallback(() => {
    setIsWebViewLoading(false)
    // Clear error state on successful load
    setWebViewError(null)
  }, [])

  /**
   * Handle WebView load errors (e.g., network failures)
   */
  const handleError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent
    console.error('📱 PrimaryWebView: WebView load error:', nativeEvent)
    setIsWebViewLoading(false)
    setWebViewError(nativeEvent)
  }, [])

  /**
   * Handle HTTP errors (e.g., 404, 500, network timeouts)
   */
  const handleHttpError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent
    console.error('📱 PrimaryWebView: WebView HTTP error:', nativeEvent)
    setIsWebViewLoading(false)
    setWebViewError(nativeEvent)
  }, [])

  // Use originalLinkingPath if available, otherwise path, otherwise fallback to '/app'.
  // Do NOT fallback to '/' — the proxy serves the marketing landing page there for
  // unauthenticated requests, and the React app never loads to fire the LOGOUT guard.
  const webViewPath = originalLinkingPath || path || '/app'
  
  if (__DEV__) {
    console.log('📱 PrimaryWebView loading path:', {
      path,
      originalLinkingPath,
      webViewPath,
      currentUser: currentUser?.id,
      fetchingUser
    })
  }
  
  // Check internet connectivity - show error screen if offline
  if (!isConnected || !isInternetReachable) {
    return (
      <NoInternetConnection 
        onRetry={() => {
          // Clear any WebView error state when retrying
          setWebViewError(null)
          // Retry will happen automatically when connectivity is restored
          // via the useEffect in NoInternetConnection component
        }} 
      />
    )
  }

  // Handle user authentication errors
  if (userError && !hasLoadedUser.current) {
    console.error('📱 PrimaryWebView: Error loading current user:', userError)
    logout()
    return null
  }

  // Show loading only on the very first render before we've ever resolved a user.
  // After that, keep the WebView mounted — the web app's RootRouter LOGOUT guard handles
  // session expiry by sending a LOGOUT message back to native.
  if (!hasLoadedUser.current && (fetchingUser || !currentUser)) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor, paddingBottom: bottomInset }} edges={safeAreaEdges}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <Loading size='large' />
      </SafeAreaView>
    )
  }

  // Show error screen if WebView failed to load due to network issues
  if (webViewError && (!isConnected || !isInternetReachable)) {
    return (
      <NoInternetConnection 
        onRetry={() => {
          // Clear error and reload WebView
          setWebViewError(null)
          setIsWebViewLoading(true)
          // WebView will reload when component re-renders
        }} 
      />
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor, paddingBottom: bottomInset }} edges={safeAreaEdges}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      {isWebViewLoading && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1
        }}>
          <Loading size='large' />
        </View>
      )}
      <HyloWebView
        ref={webViewRef}
        path={webViewPath}
        messageHandler={messageHandler}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleHttpError}
        // NOTE: Pull-to-refresh is handled on the web side via usePullToRefresh hook
        // Native pull-to-refresh doesn't work with AutoHeightWebView because:
        // - AutoHeightWebView manages its own height based on content
        // - Scrolling happens INSIDE the WebView (CSS/JS), not via native ScrollView
        // - Native pull-to-refresh needs to detect when native scroll reaches top
        // enablePullToRefresh={true}
        enableScrolling={true}
      />
    </SafeAreaView>
  )
}

