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
  // NOTE: cache-and-network is used (not network-only) — see comment below.
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()
  // cache-and-network keeps currentUser available from the urql cache during re-fetches.
  // network-only would clear currentUser to undefined on every re-fetch (e.g. Android
  // network transitions on wake), causing the loading condition below to go true, which
  // unmounts the entire navigator tree and restarts the WebView — causing an infinite loop.
  // Safe destructuring with fallback in case the result is transiently null/undefined.
  const currentUserResult = useCurrentUser({
    requestPolicy: 'cache-and-network',
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
    // Only show the loading screen until we know whether there is a logged-in user.
    // Do NOT tie this to currentUserFetching: with cache-and-network, urql sets
    // fetching=true on every background refetch while currentUser stays in the cache.
    // That used to set loading=true here, unmount PrimaryWebView, remount it (fresh
    // isWebViewLoading), and flash the native spinner on top of the web skeleton.
    if (initialized) return
    setLoading(!currentUser)
  }, [initialized, currentUser])

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  // DEPRECATED: This is no longer used, all we need to do is log the user in and a subscription will be created. Remove after 2025-08-26
  // const oneSignalChangeListener = ({ externalId, onesignalId }) => {
  //   if (externalId === currentUser?.id) {
  //     registerDevice({
  //       playerId: onesignalId,
  //       platform: Platform.OS + (isDev ? '_dev' : ''),
  //       version: hyloAppVersion
  //     })
  //   } else {
  //     console.warn(
  //       'Not registering to OneSignal for push notifications:\n' +
  //       `externalId: ${externalId} onesignalId: ${onesignalId} currentUser.id: ${currentUser?.id}`
  //     )
  //   }
  // }

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
