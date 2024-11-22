import React, { useEffect, useState } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { OneSignal } from 'react-native-onesignal'
import registerDevice from 'store/actions/registerDevice'
import { useMutation, useQuery } from 'urql'
import { useDispatch } from 'react-redux'
import i18n from '../../i18n'
import { HyloHTMLConfigProvider } from 'components/HyloHTML/HyloHTML'
import { modalScreenName } from 'hooks/useIsModalScreen'
// import { updateNewNotificationCount as resetNotificationCountAction } from 'screens/NotificationsList/NotificationsList.store'
import resetNotificationsCountMutation from 'graphql/mutations/resetNotificationsCountMutation'
import fetchNotificationsQuery, { NOTIFICATIONS_PAGE_SIZE } from 'graphql/queries/notificationsQuery'
import commonRolesQuery from 'graphql/queries/commonRolesQuery'
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
import useCurrentUser from 'hooks/useCurrentUser'

const AuthRoot = createStackNavigator()
export default function AuthRootNavigator () {
  const dispatch = useDispatch()
  const [currentUser, { fetching, error }] = useCurrentUser()
  const [loading, setLoading] = useState(true)

  const [, resetNotificationsCount] = useMutation(resetNotificationsCountMutation)
  useQuery({ query: fetchNotificationsQuery, variables: { first: NOTIFICATIONS_PAGE_SIZE, offset: 0 } })
  useQuery({ query: commonRolesQuery })
  usePlatformAgreements()

  useEffect(() => {
    resetNotificationsCount()
  }, [])

  useEffect(() => {
    (async function () {
      if (currentUser && !fetching && !error) {
        const onesignalPushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync()

        const locale = currentUser?.settings?.locale || 'en'

        i18n.changeLanguage(locale)

        if (onesignalPushSubscriptionId) {
          await dispatch(registerDevice(onesignalPushSubscriptionId))
          OneSignal.login(currentUser?.id)
          OneSignal.Notifications.requestPermission(true)
        } else {
          console.warn('Not registering to OneSignal for push notifications. OneSignal did not successfully retrieve a userId')
        }
        setLoading(false)
      }
    })()
  }, [fetching, error])

  if (loading) return <LoadingScreen />
  // TODO: What do we want to happen if there is an error loading the current user?
  if (error) console.error(error)

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
      </AuthRoot.Navigator>
    </HyloHTMLConfigProvider>
  )
}
