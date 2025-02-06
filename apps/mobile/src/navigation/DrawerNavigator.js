import React from 'react'
import { Dimensions } from 'react-native'
import { createDrawerNavigator } from '@react-navigation/drawer'
import TabsNavigator from 'navigation/TabsNavigator'
import LegacyGroupsDrawerMenu from 'screens/LegacyGroupsDrawerMenu'
import ContextMenu from 'components/ContextMenu'

const Drawer = createDrawerNavigator()
export default function DrawerNavigator () {
  const navigatorProps = {
    drawerType: 'slide',
    drawerStyle: {
      width: Dimensions.get('window').width * 0.92
    }
  }

  return (
    <Drawer.Navigator
      screenOptions={navigatorProps}
      drawerContent={props => (
        <>
          <ContextMenu />
          <LegacyGroupsDrawerMenu {...props} />
        </>
      )}
    >
      <Drawer.Screen name='Tabs' component={TabsNavigator} options={{ headerShown: false }} />
    </Drawer.Navigator>
  )
}
