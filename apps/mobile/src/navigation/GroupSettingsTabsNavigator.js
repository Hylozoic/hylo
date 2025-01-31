import React, { useLayoutEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { isIOS } from 'util/platform'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import GroupSettingsWebView from 'screens/GroupSettingsWebView'
import Avatar from 'components/Avatar'
import { alabaster, rhino, rhino40, rhino60, white } from 'style/colors'

const GroupSettings = createMaterialTopTabNavigator()
export default function GroupSettingsTabsNavigator () {
  const navigation = useNavigation()
  const route = useRoute()
  const [{ currentGroup: selectedGroup }, refetchCurrentGroup] = useCurrentGroup()
  const groupName = selectedGroup?.name
  const navigatorProps = {
    screenOptions: {
      tabBarActiveTintColor: rhino,
      tabBarInactiveTintColor: rhino40,
      tabBarIndicatorStyle: {
        backgroundColor: 'transparent'
      },
      tabBarLabelStyle: {
        fontFamily: 'Circular-Bold',
        fontSize: 14,
        textTransform: 'none'
      },
      tabBarScrollEnabled: true,
      tabBarStyle: styles.tabBarStyle,
      swipeEnabled: false
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: rhino60 },
      headerTitleStyle: { color: white },
      // Reload group on exit
      headerLeftOnPress: () => {
        refetchCurrentGroup()
        navigation.goBack()
      },
      headerTitle: props => {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar style={{ marginRight: 8 }} avatarUrl={selectedGroup?.avatarUrl} dimension={30} />
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: white }}>{groupName}</Text>
          </View>
        )
      }
    })
  }, [navigation, route, groupName])

  return (
    <GroupSettings.Navigator {...navigatorProps}>
      <GroupSettings.Screen
        name='Settings'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings`
        }}
      />
      <GroupSettings.Screen
        name='Responsibilities'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/responsibilities`
        }}
      />
      <GroupSettings.Screen
        name='Privacy & Access'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/privacy`
        }}
      />
      <GroupSettings.Screen
        name='Custom Views'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/views`
        }}
      />
      <GroupSettings.Screen
        name='Topics'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/topics`
        }}
      />
      <GroupSettings.Screen
        name='Invite'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/invite`
        }}
      />
      <GroupSettings.Screen
        name='Join Requests'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/requests`
        }}
      />
      <GroupSettings.Screen
        name='Related Groups'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/relationships`
        }}
      />
      <GroupSettings.Screen
        name='Export Data'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/export`
        }}
      />
      <GroupSettings.Screen
        name='Delete'
        component={GroupSettingsWebView}
        initialParams={{
          path: `/groups/${selectedGroup?.slug}/settings/delete`
        }}
      />
    </GroupSettings.Navigator>
  )
}

const styles = {
  tabBarStyle: (
    isIOS
      ? {
          display: 'flex',
          backgroundColor: alabaster
        }
      : {
          display: 'flex',
          backgroundColor: alabaster,
          borderTopWidth: StyleSheet.hairlineWidth
        }
  )
}
