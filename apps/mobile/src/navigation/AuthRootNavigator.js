import React, { useEffect, useState } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { OneSignal } from 'react-native-onesignal'
import { useMutation, useQuery } from 'urql'
import i18n from '../../i18n'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'
import { modalScreenName } from 'hooks/useIsModalScreen'
import resetNotificationsCountMutation from 'graphql/mutations/resetNotificationsCountMutation'
import fetchNotificationsQuery, { NOTIFICATIONS_PAGE_SIZE } from 'graphql/queries/notificationsQuery'
import registerDeviceMutation from 'graphql/mutations/registerDeviceMutation'
import commonRolesQuery from 'graphql/queries/commonRolesQuery'
import useCurrentUser from 'hooks/useCurrentUser'
import usePlatformAgreements from 'hooks/usePlatformAgreements'
import ModalHeader from 'navigation/headers/ModalHeader'
import CreateGroupTabsNavigator from 'navigation/CreateGroupTabsNavigator'
import DrawerNavigator from 'navigation/DrawerNavigator'
import GroupExploreWebView from 'screens/GroupExploreWebView'
import GroupSettingsTabsNavigator from 'navigation/GroupSettingsTabsNavigator'
import LoadingScreen from 'screens/LoadingScreen'
import MemberProfile from 'screens/MemberProfile'
import PostDetails from 'screens/PostDetails'
import PostEditor from 'screens/PostEditor'
import NotificationsList from 'screens/NotificationsList'
import Thread from 'screens/Thread'
import { white } from 'style/colors'

const AuthRoot = createStackNavigator()
export default function AuthRootNavigator () {
  // TODO: URQL - network-only seems to be required only for SocialAuth,
  // but can't yet figure out why. Explore further and hopefully reset
  // to network-and-cache or cache-first (default)
  const [currentUser, { fetching, error }] = useCurrentUser({ requestPolicy: 'network-only' })
  const [loading, setLoading] = useState(true)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  const [, registerDevice] = useMutation(registerDeviceMutation)

  useQuery({ query: fetchNotificationsQuery, variables: { first: NOTIFICATIONS_PAGE_SIZE, offset: 0 } })
  useQuery({ query: commonRolesQuery })
  usePlatformAgreements()

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  useEffect(() => {
    (async function () {
      if (currentUser && !fetching && !error) {
        const locale = currentUser?.settings?.locale || 'en'

        i18n.changeLanguage(locale)

        const onesignalPushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync()

        if (onesignalPushSubscriptionId) {
          await registerDevice({
            playerId: onesignalPushSubscriptionId,
            platform: Platform.OS + (__DEV__ ? '_dev' : ''),
            version: '2' // TODO supply real version here                  
          })
          OneSignal.login(currentUser?.id)
          OneSignal.Notifications.requestPermission(true)
        } else {
          console.warn('Not registering to OneSignal for push notifications. OneSignal did not successfully retrieve a userId')
        }

        setLoading(false)
      }
    })()
  }, [currentUser, fetching, error])

  // TODO: What do we want to happen if there is an error loading the current user?
  if (error) console.error(error)
  if (loading) return <LoadingScreen />

  const navigatorProps = {
    screenOptions: {
      cardStyle: { backgroundColor: white }
    }
  }

  return (
    <HyloHTMLConfigProvider>
      <AuthRoot.Navigator {...navigatorProps}>
        <AuthRoot.Screen name='Drawer' component={DrawerNavigator} options={{ headerShown: false }} />
        <AuthRoot.Screen
          name='Create Group' component={CreateGroupTabsNavigator}
          options={{ headerShown: false }}
        />
        <AuthRoot.Group screenOptions={{ presentation: 'modal', header: ModalHeader }}>
          <AuthRoot.Screen
            name={modalScreenName('Post Details')} component={PostDetails}
            options={{ title: 'Post Details' }}
          />
          <AuthRoot.Screen
            name={modalScreenName('Member')} component={MemberProfile}
            options={{ title: 'Member' }}
          />
          <AuthRoot.Screen
            name={modalScreenName('Group Explore')} component={GroupExploreWebView}
            options={{ title: 'Explore' }}
          />
          <AuthRoot.Screen name='Edit Post' component={PostEditor} options={{ headerShown: false }} />
          <AuthRoot.Screen name='Group Settings' component={GroupSettingsTabsNavigator} />
          <AuthRoot.Screen name={modalScreenName('Thread')} component={Thread} />
          <AuthRoot.Screen name={modalScreenName('Notifications')} component={NotificationsList} />
        </AuthRoot.Group>
        <AuthRoot.Screen name='Loading' component={LoadingScreen} options={{ headerShown: false, animationEnabled: false }} />
      </AuthRoot.Navigator>
    </HyloHTMLConfigProvider>
  )
}
