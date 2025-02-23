import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import Intercom from '@intercom/intercom-react-native'
import { LogLevel, OneSignal } from 'react-native-onesignal'
import { gql, useMutation, useQuery, useSubscription } from 'urql'
import mixpanel from 'services/mixpanel'
import { useTranslation } from 'react-i18next'
import resetNotificationsCountMutation from '@hylo/graphql/mutations/resetNotificationsCountMutation'
import notificationsQuery from '@hylo/graphql/queries/notificationsQuery'
import messageThreadFieldsFragment from '@hylo/graphql/fragments/messageThreadFieldsFragment'
import notificationFieldsFragment from '@hylo/graphql/fragments/notificationFieldsFragment'
import registerDeviceMutation from '@hylo/graphql/mutations/registerDeviceMutation'
import commonRolesQuery from '@hylo/graphql/queries/commonRolesQuery'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import usePlatformAgreements from '@hylo/hooks/usePlatformAgreements'
import { isDev } from 'config'
import { version as hyloAppVersion } from '../../package.json'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'
import { modalScreenName } from 'hooks/useIsModalScreen'
import ModalHeader from 'navigation/headers/ModalHeader'
import CreateGroupTabsNavigator from 'navigation/CreateGroupTabsNavigator'
import DrawerNavigator from 'navigation/DrawerNavigator'
import GroupExploreWebView from 'screens/GroupExploreWebView'
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
          avatarUrl
        }
        messageThread {
          id
          unreadCount
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
  const { i18n } = useTranslation()
  const [{ currentUser, fetching, error }] = useCurrentUser({ requestPolicy: 'network-only' })
  const [loading, setLoading] = useState(true)
  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  const [, registerDevice] = useMutation(registerDeviceMutation)

  useSubscription({ query: updatesSubscription })
  useQuery({ query: notificationsQuery })
  useQuery({ query: commonRolesQuery })
  usePlatformAgreements()

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  const oneSignalChangeListener = ({ externalId, onesignalId }) => {
    if (externalId === currentUser?.id) {
      registerDevice({
        playerId: onesignalId,
        platform: Platform.OS + (isDev ? '_dev' : ''),
        version: hyloAppVersion
      })
    } else {
      console.warn(
        'Not registering to OneSignal for push notifications:\n' +
        `externalId: ${externalId} onesignalId: ${onesignalId} currentUser.id: ${currentUser?.id}`
      )
    }
  }

  useEffect(() => {
    (async function () {
      if (currentUser && !fetching && !error) {
        const locale = currentUser?.settings?.locale || 'en'

        // Locale setup
        i18n.changeLanguage(locale)

        // OneSignal setup
        if (isDev) OneSignal.Debug.setLogLevel(LogLevel.Verbose)
        OneSignal.User.addEventListener('change', oneSignalChangeListener)
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

        setLoading(false)
      }
    })()

    return () => {
      OneSignal.User.removeEventListener('change', oneSignalChangeListener)
    }
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
          <AuthRoot.Screen name={modalScreenName('Thread')} component={Thread} />
          <AuthRoot.Screen name={modalScreenName('Notifications')} component={NotificationsList} />
        </AuthRoot.Group>
        <AuthRoot.Screen name='Loading' component={LoadingScreen} options={{ headerShown: false, animationEnabled: false }} />
      </AuthRoot.Navigator>
    </HyloHTMLConfigProvider>
  )
}
