import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import Intercom from '@intercom/intercom-react-native'
import { LogLevel, OneSignal } from 'react-native-onesignal'
import { gql, useMutation, useQuery, useSubscription } from 'urql'
import i18n from '../../i18n'
import mixpanel from 'services/mixpanel'
import { version as hyloAppVersion } from '../../package.json'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'
import { modalScreenName } from 'hooks/useIsModalScreen'
import resetNotificationsCountMutation from 'frontend-shared/graphql/mutations/resetNotificationsCountMutation'
import notificationsQuery from 'frontend-shared/graphql/queries/notificationsQuery'
import messageThreadFieldsFragment from 'frontend-shared/graphql/fragments/messageThreadFieldsFragment'
import notificationFieldsFragment from 'frontend-shared/graphql/fragments/notificationFieldsFragment'
import registerDeviceMutation from 'frontend-shared/graphql/mutations/registerDeviceMutation'
import commonRolesQuery from 'frontend-shared/graphql/queries/commonRolesQuery'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'
import usePlatformAgreements from 'frontend-shared/hooks/usePlatformAgreements'
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

const updatesSubscription = gql`
  subscription UpdatesSubscription($firstMessages: Int = 1) {
    updates {
      ... on Notification {
        ...NotificationFieldsFragment
      }
      ... on MessageThread {
        ...MessageThreadFieldsFragment
      }
      ... on Message {
        id
        createdAt
        text
        creator {
          id
          name
        }
        messageThread {
          id
        }
      }
      
    }
  }
  ${notificationFieldsFragment}
  ${messageThreadFieldsFragment}
`

const AuthRoot = createStackNavigator()
export default function AuthRootNavigator () {
  // TODO: URQL - network-only seems to be required only for SocialAuth,
  // but can't yet figure out why. Explore further and hopefully reset
  // to cache-and-network or cache-first (default). It may be fine here, but it is
  // the only place we should do this with useCurrentUser as it would be expensive
  // lower in the stack where it may get called in any loops and such.
  const [{ currentUser, fetching, error }] = useCurrentUser({ requestPolicy: 'network-only' })
  const [loading, setLoading] = useState(true)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  const [, registerDevice] = useMutation(registerDeviceMutation)

  useQuery({ query: notificationsQuery })
  useQuery({ query: commonRolesQuery })
  usePlatformAgreements()
  useSubscription({ query: updatesSubscription })

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  useEffect(() => {
    (async function () {
      if (currentUser && !fetching && !error) {
        const locale = currentUser?.settings?.locale || 'en'

        // Locale setting
        i18n.changeLanguage(locale)
        OneSignal.Debug.setLogLevel(LogLevel.Verbose)

        // OneSignal registration and identification
        const onesignalPushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync()

        if (onesignalPushSubscriptionId) {
          await registerDevice({
            playerId: onesignalPushSubscriptionId,
            platform: Platform.OS + (__DEV__ ? '_dev' : ''),
            version: hyloAppVersion
          })
          OneSignal.login(currentUser?.id)
          OneSignal.Notifications.requestPermission(true)
        } else {
          console.warn('Not registering to OneSignal for push notifications. OneSignal did not successfully retrieve a userId')
        }

        // Intercom user setup
        // Intercom.setUserHash(user.hash)
        Intercom.loginUserWithUserAttributes({
          userId: currentUser?.id,
          name: currentUser?.name,
          email: currentUser?.email
        })

        // MixPanel user identify
        mixpanel.identify(currentUser?.id)
        mixpanel.getPeople().set({
          $name: currentUser?.name,
          $email: currentUser?.email,
          $location: currentUser?.location
        })

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
