import React from 'react'
import { StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { isIOS } from 'util/platform'
import { get } from 'lodash/fp'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { modalScreenName } from 'hooks/useIsModalScreen'
import Icon from 'components/Icon'
import {
  alabaster, black10OnCaribbeanGreen, gainsboro, gunsmoke, white
} from 'style/colors'
import HomeNavigator from 'navigation/HomeNavigator'
import SearchNavigator from 'navigation/SearchNavigator'
import MessagesNavigator from 'navigation/MessagesNavigator'
import { useNavigation } from '@react-navigation/native'

const Tabs = createBottomTabNavigator()
export default function TabsNavigator () {
  const [{ currentUser }] = useCurrentUser()
  const navigation = useNavigation()
  const showNotificationBadge = !!get('newNotificationCount', currentUser)
  const messagesBadgeCount = currentUser?.unseenThreadCount > 0
    ? currentUser?.unseenThreadCount
    : null

  const navigatorProps = {
    screenOptions: ({ route }) => ({
      // Set only for Android as it makes undesirable animation in iOS
      tabBarHideOnKeyboard: !isIOS,
      tabBarShowLabel: true,
      tabBarPressColor: gainsboro,
      tabBarIndicatorStyle: { backgroundColor: white },
      tabBarStyle: isIOS
        ? {
            display: 'flex',
            backgroundColor: alabaster
          }
        : {
            display: 'flex',
            backgroundColor: alabaster,
            borderTopWidth: StyleSheet.hairlineWidth
          },
      tabBarIcon: ({ focused }) => (
        <Icon
          name={route.name.split(' Tab')[0]}
          size={32}
          color={focused ? black10OnCaribbeanGreen : gunsmoke}
          style={{ paddingTop: isIOS ? 0 : 5 }}
        />
      ),
      tabBarLabel: () => null,
      headerShown: false
    })
  }

  return (
    <Tabs.Navigator {...navigatorProps}>
      <Tabs.Screen name='Home Tab' component={HomeNavigator} />
      <Tabs.Screen name='Messages Tab' component={MessagesNavigator} options={{ tabBarBadge: messagesBadgeCount }} />
      <Tabs.Screen
        name='Notifications Tab'
        component={HomeNavigator} // it will never navigate to this but we need to pass a valid component here anyway
        listeners={{
          tabPress: (e) => {
            navigation.navigate(modalScreenName('Notifications'))

            e.preventDefault()
          }
        }}
        options={{
          tabBarBadge: showNotificationBadge
        }}
      />
      <Tabs.Screen name='Search Tab' component={SearchNavigator} />
    </Tabs.Navigator>
  )
}
