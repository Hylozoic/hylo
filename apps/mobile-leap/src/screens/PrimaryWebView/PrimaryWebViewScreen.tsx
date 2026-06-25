import Constants from 'expo-constants'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebView } from 'react-native-webview'
import { WebViewMessageTypes } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import HyloWebView from '../../components/HyloWebView/HyloWebView'
import LoadingScreen from '../../components/LoadingScreen'
import useLogout from '../../hooks/useLogout'
import useNetworkConnectivity from '../../hooks/useNetworkConnectivity'
import useRouteParams from '../../hooks/useRouteParams'
import useThemeStore from '../../store/themeStore'
import { isIOS } from '../../util/platform'
import NoInternetConnectionScreen from '../NoInternetConnection/NoInternetConnectionScreen'

const hyloAppVersion = Constants.expoConfig?.version ?? '1.0.0'

export default function PrimaryWebViewScreen () {
  const webViewRef = useRef<WebView>(null)
  const logout = useLogout()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()
  const { backgroundColor, colorScheme, setTheme, hydrate } = useThemeStore()
  const insets = useSafeAreaInsets()

  useEffect(() => { hydrate() }, [hydrate])

  const bottomInset = isIOS ? Math.max(insets.bottom * 0.5, 8) : insets.bottom
  const safeAreaEdges = isIOS
    ? (['top', 'left', 'right'] as const)
    : (['top', 'left', 'right', 'bottom'] as const)

  const currentUserResult = useCurrentUser({
    requestPolicy: 'cache-and-network',
    pause: !isConnected || !isInternetReachable
  })
  const { currentUser, fetching: fetchingUser, error: userError } = currentUserResult?.[0] ?? {}

  const hasLoadedUser = useRef(false)
  if (currentUser) hasLoadedUser.current = true

  const [isWebViewLoading, setIsWebViewLoading] = useState(true)
  const [webViewError, setWebViewError] = useState<unknown>(null)

  const { path, originalLinkingPath } = useRouteParams()

  const messageHandler = useCallback((message: { type: string, data?: { themeName?: string, colorScheme?: string } }) => {
    const { type, data } = message

    switch (type) {
      case WebViewMessageTypes.LOGOUT:
        logout()
        break
      case WebViewMessageTypes.THEME_CHANGE: {
        const { themeName, colorScheme: scheme } = data || {}
        if (themeName && scheme) setTheme(themeName, scheme)
        break
      }
      case WebViewMessageTypes.AUTH_SUCCESS:
        break
      default:
        if (__DEV__ && type) {
          console.log('Unknown WebView message type:', type, data)
        }
    }
  }, [logout, setTheme])

  const handleLoadEnd = useCallback(() => {
    setIsWebViewLoading(false)
    setWebViewError(null)
  }, [])

  const handleError = useCallback((syntheticEvent: { nativeEvent: unknown }) => {
    console.warn('PrimaryWebView load error:', syntheticEvent.nativeEvent)
    setIsWebViewLoading(false)
    setWebViewError(syntheticEvent.nativeEvent)
  }, [])

  const handleHttpError = useCallback((syntheticEvent: { nativeEvent: unknown }) => {
    console.warn('PrimaryWebView HTTP error:', syntheticEvent.nativeEvent)
    setIsWebViewLoading(false)
    setWebViewError(syntheticEvent.nativeEvent)
  }, [])

  const webViewPath = originalLinkingPath || path || '/app'

  if (!hasLoadedUser.current && (!isConnected || !isInternetReachable)) {
    return (
      <NoInternetConnectionScreen onRetry={() => setWebViewError(null)} />
    )
  }

  if (userError && !hasLoadedUser.current) {
    console.warn('PrimaryWebView user error:', userError)
    logout()
    return null
  }

  if (webViewError && (!isConnected || !isInternetReachable)) {
    return (
      <NoInternetConnectionScreen
        onRetry={() => {
          setWebViewError(null)
          setIsWebViewLoading(true)
        }}
      />
    )
  }

  const showLoadingOverlay = !hasLoadedUser.current || fetchingUser || isWebViewLoading

  return (
    <SafeAreaView
      className='flex-1'
      style={{ backgroundColor, paddingBottom: bottomInset }}
      edges={safeAreaEdges}
    >
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      {showLoadingOverlay && (
        <View
          className='absolute inset-0 z-10 items-center justify-center'
          style={{ backgroundColor }}
        >
          <LoadingScreen />
        </View>
      )}
      {hasLoadedUser.current && currentUser && (
        <HyloWebView
          ref={webViewRef}
          path={webViewPath}
          mobileAppVersion={hyloAppVersion}
          messageHandler={messageHandler}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          enableScrolling
        />
      )}
    </SafeAreaView>
  )
}
