// DEPRECATED: This navigator is no longer used.
// All navigation is now handled by the web app displayed in PrimaryWebView.
// The drawer menu, tabs, and all nested navigators have been replaced.
// Kept for reference only.
// Last used: 2025-01-28

/*
import React from 'react'
import { Dimensions } from 'react-native'
import { createDrawerNavigator } from '@react-navigation/drawer'
import DrawerMenu from 'components/DrawerMenu'
import TabsNavigator from 'navigation/TabsNavigator'

const Drawer = createDrawerNavigator()
export default function DrawerNavigator () {
  const navigatorProps = {
    drawerType: 'slide',
    drawerStyle: {
      width: Dimensions.get('window').width * 0.92
    }
  }

  return (
    <Drawer.Navigator screenOptions={navigatorProps} drawerContent={DrawerMenu}>
      <Drawer.Screen name='Tabs' component={TabsNavigator} options={{ headerShown: false }} />
    </Drawer.Navigator>
  )
}
*/

// No-op export - navigator is deprecated
export default function DrawerNavigator () {
  return null
}
