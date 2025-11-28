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
import { twBackground } from '@hylo/presenters/colors'
import useUnifiedSubscription from '@hylo/hooks/useUnifiedSubscription'

const AuthRoot = createStackNavigator()
export default function AuthRootNavigator () {
  // TODO: URQL - network-only seems to be required only for SocialAuth,
  // but can't yet figure out why. Explore further and hopefully reset
  // to cache-and-network or cache-first (default). It may be fine here, but it is
  // the only place we should do this with useCurrentUser as it would be expensive
  // lower in the stack where it may get called in any loops and such.
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  const [{ currentUser, fetching: currentUserFetching, error }] = useCurrentUser({ requestPolicy: 'network-only' })
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialize] = useState(false)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)

  // ANDROID SSE LIMIT: Use unified subscription instead of individual ones
  // This stays within Android's 4 concurrent SSE connection limit
  // Pause until we have a currentUser to avoid unauthenticated subscription attempts
  useUnifiedSubscription({ pause: !currentUser })

  useQuery({ query: notificationsQuery })
  useQuery({ query: commonRolesQuery })
  usePlatformAgreements()
  useHandleLinking()

  useEffect(() => {
    setLoading(!initialized || !currentUser || currentUserFetching)
  }, [initialized, currentUser, currentUserFetching])

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
