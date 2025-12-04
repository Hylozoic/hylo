import React, { useRef, useCallback, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import HyloWebView from 'components/HyloWebView'
import Loading from 'components/Loading'
import useLogout from 'hooks/useLogout'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useRouteParams from 'hooks/useRouteParams'

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
  
  // Verify user is authenticated before showing WebView
  // This provides an additional auth check at the component level
  const [{ currentUser, fetching: fetchingUser, error: userError }] = useCurrentUser({ 
    requestPolicy: 'network-only'
  })
  const [isWebViewLoading, setIsWebViewLoading] = useState(true)
  
  // Get the path from the route params
  // This comes from the linking table catch-all: ':path(.*)' -> Main
  const { path, originalLinkingPath } = useRouteParams()
  
  // Use originalLinkingPath if available, otherwise path, otherwise default to '/'
  const webViewPath = originalLinkingPath || path || '/'
  
  if (__DEV__) {
    console.log('📱 PrimaryWebView loading path:', {
      path,
      originalLinkingPath,
      webViewPath,
      currentUser: currentUser?.id,
      fetchingUser
    })
  }
  
  // Handle user authentication errors
  if (userError) {
    console.error('📱 PrimaryWebView: Error loading current user:', userError)
    // Logout and let AuthContext handle redirect to login
    logout()
    return null
  }
  
  // Show loading while fetching user data
  // This ensures we have a valid authenticated user before rendering the WebView
  if (fetchingUser || !currentUser) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Loading size='large' />
      </SafeAreaView>
    )
  }
  
  /**
   * Simplified message handler
   * 
   * Previous implementation handled:
   * - NAVIGATION: Routed to native screens (no longer needed - web handles all nav)
   * - GROUP_DELETED: Cleared state and navigated (no longer needed - web handles)
   * 
   * Now only handles:
   * - LOGOUT: Trigger native logout flow
   */
  const messageHandler = useCallback((message) => {
    const { type, data } = message
    
    switch (type) {
      case 'LOGOUT':
        // Web app triggers logout, native handles the actual logout
        console.log('📱 Logout triggered from WebView')
        logout()
        break
        
      // DEPRECATED: These cases are no longer needed
      // case 'NAVIGATION': Web app handles all navigation now
      // case 'GROUP_DELETED': Web app handles group deletion navigation
      
      default:
        // Log unknown message types in dev for debugging
        if (__DEV__ && type) {
          console.log('📱 Unknown WebView message type:', type, data)
        }
    }
  }, [logout])
  
  /**
   * Handle WebView load completion
   */
  const handleLoadEnd = useCallback(() => {
    setIsWebViewLoading(false)
  }, [])
  
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
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

