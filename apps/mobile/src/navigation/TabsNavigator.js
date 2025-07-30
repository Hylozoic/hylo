import React from 'react'
import { StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { isIOS } from 'util/platform'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import HomeNavigator from 'navigation/HomeNavigator'
import Icon from 'components/Icon'
import MessagesNavigator from 'navigation/MessagesNavigator'
import SearchNavigator from 'navigation/SearchNavigator'
import { black10OnCaribbeanGreen, gainsboro, gunsmoke, twBackground } from '@hylo/presenters/colors'

const DummyComponent = () => {}

const Tabs = createBottomTabNavigator()
export default function TabsNavigator () {
  const [{ currentUser }] = useCurrentUser()
  const navigation = useNavigation()
  const notificationsBadgeCount = currentUser?.newNotificationCount > 0
    ? currentUser?.newNotificationCount
    : null
  const messagesBadgeCount = currentUser?.unseenThreadCount > 0
    ? currentUser?.unseenThreadCount
    : null

  const navigatorProps = {
    screenOptions: ({ route }) => ({
      // Set only for Android as it makes undesirable animation in iOS
      tabBarHideOnKeyboard: !isIOS,
      tabBarShowLabel: true,
      tabBarPressColor: gainsboro,
      tabBarIndicatorStyle: { backgroundColor: twBackground },
      tabBarStyle: isIOS
        ? {
            display: 'flex',
            backgroundColor: twBackground
          }
        : {
            display: 'flex',
            backgroundColor: twBackground,
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
      <Tabs.Screen name='Search Tab' component={SearchNavigator} />
      <Tabs.Screen
        name='Notifications Tab'
        component={DummyComponent}
        listeners={{
          tabPress: (e) => {
            navigation.navigate('Notifications')
            e.preventDefault()
          }
        }}
        options={{
          tabBarBadge: notificationsBadgeCount
        }}
      />
    </Tabs.Navigator>
  )
}
