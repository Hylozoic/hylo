import React from 'react'
import { Dimensions } from 'react-native'
import { createDrawerNavigator } from '@react-navigation/drawer'
// Navigation
import TabsNavigator from 'navigation/TabsNavigator'
// Screens
import DrawerMenu from 'screens/DrawerMenu'

const Drawer = createDrawerNavigator()
export default function DrawerNavigator () {
  const navigatorProps = {
    drawerType: 'slide',
    drawerStyle: {
      width: Dimensions.get('window').width * 0.9
    },
    // Without this Drawer was re-opening sometimes after nav
    // something to do with Reanimated 2.0 config probably
    useLegacyImplementation: true,
    drawerContent: props => (
      <DrawerMenu {...props} />
    )
  }

  return (
    <Drawer.Navigator {...navigatorProps}>
      <Drawer.Screen name='Tabs' component={TabsNavigator} options={{ headerShown: false }} />
    </Drawer.Navigator>
  )
}
