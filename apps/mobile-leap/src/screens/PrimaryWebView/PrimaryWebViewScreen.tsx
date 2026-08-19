import Constants from 'expo-constants'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, Platform, StatusBar, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WebView } from 'react-native-webview'
import { WebViewMessageTypes, HYLO_HARDWARE_BACK_EVENT } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import HyloWebView from '../../components/HyloWebView/HyloWebView'
import LoadingScreen from '../../components/LoadingScreen'
import useLogout from '../../hooks/useLogout'
import useNetworkConnectivity from '../../hooks/useNetworkConnectivity'
import useRouteParams from '../../hooks/useRouteParams'
import useThemeStore from '../../store/themeStore'
import { isIOS } from '../../util/platform'
import { authHandshakeEvent } from '../../util/authDebug'
import { normalizeWebPath } from '../../util/session'
import NoInternetConnectionScreen from '../NoInternetConnection/NoInternetConnectionScreen'

const hyloAppVersion = Constants.expoConfig?.version ?? '1.0.0'

export default function PrimaryWebViewScreen () {
  const webViewRef = useRef<WebView>(null)
  const logout = useLogout()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()
  const { backgroundColor, colorScheme, setTheme, hydrate } = useThemeStore()
  const insets = useSafeAreaInsets()

  useEffect(() => { hydrate() }, [hydrate])

  // iOS: small manual bottom pad for the home indicator. Android: no bottom inset —
  // RN 0.85 edge-to-edge reports nav-bar insets; padding here shrinks the WebView and
  // leaves a dead band (legacy RN 0.77 reported 0 on the same devices). Web content
  // extends to the screen bottom like the existing mobile app.
  const bottomInset = isIOS ? Math.max(insets.bottom * 0.5, 8) : 0
  const safeAreaEdges = ['top', 'left', 'right'] as const

  const currentUserResult = useCurrentUser({
    requestPolicy: 'cache-and-network',
    pause: !isConnected || !isInternetReachable
  })
  const { currentUser, error: userError } = currentUserResult?.[0] ?? {}

  const hasLoadedUser = useRef(false)
  if (currentUser) hasLoadedUser.current = true

  const [isWebViewLoading, setIsWebViewLoading] = useState(true)
  const [isCookieResolving, setIsCookieResolving] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [webViewError, setWebViewError] = useState<unknown>(null)
  const [sessionRecovering, setSessionRecovering] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const onHardwareBackPress = () => {
      if (!webViewRef.current) return false

      webViewRef.current.injectJavaScript(`
        window.dispatchEvent(new CustomEvent(${JSON.stringify(HYLO_HARDWARE_BACK_EVENT)}));
        true;
      `)
      return true
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress)
    return () => subscription.remove()
  }, [])

  const { path, originalLinkingPath } = useRouteParams()

  const messageHandler = useCallback((message: { type: string, data?: { themeName?: string, colorScheme?: string } }) => {
    const { type, data } = message

    switch (type) {
      case WebViewMessageTypes.LOGOUT:
        authHandshakeEvent('LOGOUT received from web', {}, 'warning')
        setIsLoggingOut(true)
        setSessionRecovering(false)
        setIsWebViewLoading(true)
        setIsCookieResolving(true)
        logout()
        break
      case WebViewMessageTypes.THEME_CHANGE: {
        const { themeName, colorScheme: scheme } = data || {}
        if (themeName && scheme) setTheme(themeName, scheme)
        break
      }
      case WebViewMessageTypes.CAN_EXIT_APP:
        BackHandler.exitApp()
        break
      case WebViewMessageTypes.AUTH_SUCCESS:
        setSessionRecovering(false)
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

  const webViewPath = normalizeWebPath(originalLinkingPath || path || '/app')
  const showLoadingOverlay = isLoggingOut || !hasLoadedUser.current || isCookieResolving || isWebViewLoading || sessionRecovering

  useEffect(() => {
    if (!showLoadingOverlay) return
    const delays = [5000, 15000, 30000]
    const timers = delays.map(ms => setTimeout(() => {
      authHandshakeEvent('PrimaryWebView loading overlay', {
        elapsedMs: ms,
        hasLoadedUser: hasLoadedUser.current,
        isCookieResolving,
        isWebViewLoading,
        sessionRecovering,
        isLoggingOut,
        userId: currentUser?.id
      }, 'warning')
    }, ms))
    return () => timers.forEach(clearTimeout)
  }, [showLoadingOverlay, isCookieResolving, isWebViewLoading, sessionRecovering, isLoggingOut, currentUser?.id])

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
      {hasLoadedUser.current && currentUser && !isLoggingOut && (
        <HyloWebView
          ref={webViewRef}
          path={webViewPath}
          mobileAppVersion={hyloAppVersion}
          messageHandler={messageHandler}
          onSessionRecoveryStart={() => setSessionRecovering(true)}
          onSessionRecoveryEnd={() => setSessionRecovering(false)}
          onCookieStateChange={setIsCookieResolving}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          enableScrolling
        />
      )}
    </SafeAreaView>
  )
}
