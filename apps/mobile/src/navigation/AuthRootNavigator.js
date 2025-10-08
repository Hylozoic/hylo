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
import { modalScreenName } from 'hooks/useIsModalScreen'
import useRouteParams from 'hooks/useRouteParams'
import ModalHeader from 'navigation/headers/ModalHeader'
import CreateGroup from 'screens/CreateGroup'
import DrawerNavigator from 'navigation/DrawerNavigator'
import CreationOptions from 'screens/CreationOptions'
import GroupExploreWebView from 'screens/GroupExploreWebView'
import HyloWebView from 'components/HyloWebView'
import LoadingScreen from 'screens/LoadingScreen'
import MemberProfile from 'screens/MemberProfile'
import PostDetails from 'screens/PostDetails'
import PostEditor from 'screens/PostEditor'
import NotificationsList from 'screens/NotificationsList'
import Thread from 'screens/Thread'
import UploadAction from 'screens/UploadAction'
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
  if (loading) return <LoadingScreen />

  const navigatorProps = {
    screenOptions: {
      cardStyle: { backgroundColor: twBackground }
    }
  }

  return (
    <HyloHTMLConfigProvider>
      <AuthRoot.Navigator {...navigatorProps}>
        <AuthRoot.Screen name='Drawer' component={DrawerNavigator} options={{ headerShown: false }} />
        <AuthRoot.Screen name='Create Group' component={CreateGroup} options={{ headerShown: false }} />
        <AuthRoot.Screen name='Loading' component={LoadingScreen} options={{ headerShown: false, animationEnabled: false }} />
        {/*
          == Modals ==
          modelScreenName is used to differentiate screen names from ones that have a non-model counterpart,
          it is used to simply consistently appends '- Modal` to then be used by const isModalScreen = useIsModalScreen()
          in views which have different behavior when opened as a modal. Don't use it if there is no non-modal
          counterpart to a modal screen.
        */}
        <AuthRoot.Screen name='Notifications' component={NotificationsList} />

        <AuthRoot.Group screenOptions={{ 
          presentation: 'modal', 
          header: ModalHeader,
          cardStyle: { 
            backgroundColor: twBackground,
            // Add safe area insets to the card style
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right
          },
          // Let React Navigation handle safe areas naturally
          cardOverlayEnabled: false,
          // Ensure proper safe area handling for modals
          headerStatusBarHeight: undefined
        }}>
          <AuthRoot.Screen
            name='Creation'
            component={CreationOptions}
            options={{
              title: 'Create',
              presentation: 'transparentModal',
              headerShown: false,
              cardStyle: { backgroundColor: 'transparent' }
            }}
          />
          <AuthRoot.Screen name='Edit Post' component={PostEditor} options={{ headerShown: false }} />
          <AuthRoot.Screen name={modalScreenName('Group Explore')} component={GroupExploreWebView} options={{ title: 'Explore' }} />
          <AuthRoot.Screen name={modalScreenName('Member')} component={MemberProfile} options={{ title: 'Member' }} />
          <AuthRoot.Screen name='Upload Action' component={UploadAction} />
          <AuthRoot.Screen name={modalScreenName('Post Details')} component={PostDetails} options={{ title: 'Post Details' }} />
          <AuthRoot.Screen name={modalScreenName('Thread')} component={Thread} />
          <AuthRoot.Screen name={modalScreenName('Web View')} component={HyloWebView} />
        </AuthRoot.Group>
      </AuthRoot.Navigator>
    </HyloHTMLConfigProvider>
  )
}
