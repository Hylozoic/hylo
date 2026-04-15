import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Intercom from '@intercom/intercom-react-native'
import { LogLevel, OneSignal } from 'react-native-onesignal'
import { useMutation, useQuery } from 'urql'
import mixpanel from 'services/mixpanel'
import { useTranslation } from 'react-i18next'
import resetNotificationsCountMutation from '@hylo/graphql/mutations/resetNotificationsCountMutation'
import notificationsQuery from '@hylo/graphql/queries/notificationsQuery'
import commonRolesQuery from '@hylo/graphql/queries/commonRolesQuery'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import usePlatformAgreements from '@hylo/hooks/usePlatformAgreements'
import useHandleLinking from 'navigation/linking/useHandleLinking'
import { isDev } from 'config'
import { version as hyloAppVersion } from '../../package.json'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'
import PrimaryWebView from 'screens/PrimaryWebView'
import LoadingScreen from 'screens/LoadingScreen'
import NoInternetConnection from 'screens/NoInternetConnection'
import { twBackground } from '@hylo/presenters/colors'
import useUnifiedSubscription from '@hylo/hooks/useUnifiedSubscription'
import useNetworkConnectivity from 'hooks/useNetworkConnectivity'

const AuthRoot = createStackNavigator()
export default function AuthRootNavigator () {
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()
  // network-only is required here (not cache-and-network):
  // After social login (Google/Apple) on a fresh install, the graphcache still holds the
  // pre-login Me:'me' = null entity. cache-and-network would serve that stale null first,
  // keeping currentUser=null and loading=true indefinitely. network-only skips the cache
  // and goes directly to the server, which returns the authenticated user via the freshly-set
  // session cookie — giving a clean null→user transition after any login.
  // Re-fetches after initialization are safe: the `if (initialized) return` guard in the
  // loading effect below prevents loading from flipping back to true, so the navigator tree
  // and WebView stay mounted even when currentUser is briefly undefined during a re-fetch.
  const currentUserResult = useCurrentUser({
    requestPolicy: 'network-only',
    pause: !isConnected || !isInternetReachable
  })
  const { currentUser, fetching: currentUserFetching, error } = currentUserResult?.[0] ?? {}
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialize] = useState(false)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)

  // ANDROID SSE LIMIT: Use unified subscription instead of individual ones
  // This stays within Android's 4 concurrent SSE connection limit
  // Pause until we have a currentUser to avoid unauthenticated subscription attempts
  // Also pause if no internet connectivity
  useUnifiedSubscription({ pause: !currentUser || !isConnected || !isInternetReachable })

  // Pause queries if no internet connectivity
  useQuery({ query: notificationsQuery, pause: !isConnected || !isInternetReachable })
  useQuery({ query: commonRolesQuery, pause: !isConnected || !isInternetReachable })
  usePlatformAgreements()
  useHandleLinking()

  useEffect(() => {
    // Loading sequence gap (do not reintroduce `currentUserFetching` here):
    // 1) urql cache-and-network often yields cached currentUser with fetching=false →
    //    loading=false → PrimaryWebView mounts, WebView loads, user sees web skeleton.
    // 2) The network leg starts → currentUserFetching=true while currentUser stays cached.
    // 3) If we used setLoading(!currentUser || currentUserFetching), loading flips TRUE
    //    before `initialized` is set (OneSignal/Intercom effect is still async).
    // 4) That unmounts the whole navigator → PrimaryWebView remounts with fresh
    //    isWebViewLoading=true → RN spinner flashes on top of the web UI, then WebView
    //    loads again.
    // So: gate only on “do we have a user record?”, not on background refetch.
    if (initialized) return
    setLoading(!currentUser)
  }, [initialized, currentUser])

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  useEffect(() => {
    (async function () {
      if (!initialized && currentUser && !currentUserFetching && !error) {
        const locale = currentUser?.settings?.locale || 'en'

        // Locale setup
        i18n.changeLanguage(locale)

        // OneSignal setup
        if (isDev) OneSignal.Debug.setLogLevel(LogLevel.Verbose)
        // TOOD push notif: Add soft prompt setup for push notifs
        const permissionGranted = await OneSignal.Notifications.canRequestPermission()
        if (permissionGranted) OneSignal.Notifications.requestPermission(true)
        OneSignal.login(currentUser?.id)

        // Intercom setup
        // TODO: URQL - does  setUserHash need to happen? Test. It stopped working.
        // Intercom.setUserHash(user.hash)
        Intercom.loginUserWithUserAttributes({
          userId: currentUser?.id,
          name: currentUser?.name,
          email: currentUser?.email
        })

        // MixPanel setup
        mixpanel.identify(currentUser?.id)
        mixpanel.getPeople().set({
          $name: currentUser?.name,
          $email: currentUser?.email,
          $location: currentUser?.location
        })

        setInitialize(true)
      }
    })()
  }, [initialized, currentUser, currentUserFetching, error])

  // TODO: What do we want to happen if there is an error loading the current user?
  if (error) console.error(error)
  
  // Only show NoInternetConnection during the INITIAL load (before initialized).
  // After initialization, keep the navigator tree mounted — Android fires
  // isInternetReachable=false events on resume that would otherwise unmount and
  // remount PrimaryWebView, causing the 3-4 reload loop on app icon reopen.
  if (!initialized && (!isConnected || !isInternetReachable)) {
    return (
      <NoInternetConnection 
        onRetry={() => {
          // Retry will happen automatically when connectivity is restored
          // via the useEffect in NoInternetConnection component
        }} 
      />
    )
  }
  
  // Initial loading state before auth completes
  // This is different from PrimaryWebView's loading state which handles WebView content loading
  if (loading) return <LoadingScreen />

  const navigatorProps = {
    screenOptions: {
      cardStyle: { backgroundColor: twBackground }
    }
  }

  return (
    <HyloHTMLConfigProvider>
      <AuthRoot.Navigator {...navigatorProps}>
        {/* 
          PRIMARY WEBVIEW ARCHITECTURE
          
          Single full-screen WebView handles all authenticated content.
          The web app provides its own navigation (drawer, tabs, routing, etc.)
          
          All previous native screens (Drawer, Stream, Messages, Posts, Members, etc.)
          are now handled by the web app displayed in PrimaryWebView.
          
          PrimaryWebView includes its own loading state for WebView content.
        */}
        <AuthRoot.Screen 
          name='Main' 
          component={PrimaryWebView} 
          options={{ headerShown: false }} 
        />
      </AuthRoot.Navigator>
    </HyloHTMLConfigProvider>
  )
}
