import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import Intercom from '@intercom/intercom-react-native'
import { useNavigation } from '@react-navigation/native'
import { isIOS } from 'util/platform'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import Icon from 'components/Icon'
import Avatar from 'components/Avatar'
import { black10OnCaribbeanGreen, gainsboro, gunsmoke, rhino05, rhino10, rhino60, white } from 'style/colors'
import HomeNavigator from 'navigation/HomeNavigator'
import SearchNavigator from 'navigation/SearchNavigator'
import MessagesNavigator from 'navigation/MessagesNavigator'
import useChangeToGroup from 'hooks/useChangeToGroup'
import { MY_CONTEXT_SLUG } from '@hylo/shared'

const Tabs = createBottomTabNavigator()
export default function TabsNavigator () {
  const [{ currentUser }] = useCurrentUser()
  const navigation = useNavigation()
  const changeToGroup = useChangeToGroup()
  const messagesBadgeCount = currentUser?.unseenThreadCount > 0
    ? currentUser?.unseenThreadCount
    : null

  const navigatorProps = {
    screenOptions: ({ route }) => ({
      // TODO: Required for Android, not iOS
      // Set only for Android as it makes undesirable animation in iOS
      tabBarHideOnKeyboard: !isIOS,
      tabBarShowLabel: true,
      tabBarPressColor: gainsboro,
      tabBarIndicatorStyle: { backgroundColor: white },
      tabBarStyle: isIOS
        ? {
            display: 'flex',
            backgroundColor: rhino10
          }
        : {
            display: 'flex',
            backgroundColor: rhino10,
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

  const handleSupportTabPress = () => {
    Intercom.present()
  }

  const handleMyContextPress = () => {
    changeToGroup(MY_CONTEXT_SLUG, false)
    navigation.openDrawer()
  }

  return (
    <Tabs.Navigator {...navigatorProps}>
      <Tabs.Screen name='Home Tab' component={HomeNavigator} />
      <Tabs.Screen name='Search Tab' component={SearchNavigator} />
      <Tabs.Screen name='Messages Tab' component={MessagesNavigator} options={{ tabBarBadge: messagesBadgeCount }} />
      <Tabs.Screen
        name='Support Tab'
        component={HomeNavigator} // it will never navigate to this but we need to pass a valid component here anyway
        listeners={{
          tabPress: (e) => {
            handleSupportTabPress()

            e.preventDefault()
          }
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 28, fontFamily: 'Circular-Bold', color: focused ? black10OnCaribbeanGreen : rhino60 }}>?</Text>
          )
        }}
      />
      <Tabs.Screen
        name='Settings Tab'
        component={HomeNavigator} // it will never navigate to this but we need to pass a valid component here anyway
        listeners={{
          tabPress: (e) => {
            handleMyContextPress()

            e.preventDefault()
          }
        }}
        options={{
          tabBarIcon: ({ focused }) => (
            <Avatar
              style={{
                borderWidth: 2,
                borderColor: focused ? black10OnCaribbeanGreen : rhino05
              }}
              dimension={34}
              hasBorder
              avatarUrl={currentUser?.avatarUrl}
            />
          )
        }}
      />
    </Tabs.Navigator>
  )
}
