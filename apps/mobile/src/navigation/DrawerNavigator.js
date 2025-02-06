import React from 'react'
import { Dimensions } from 'react-native'
import { createDrawerNavigator } from '@react-navigation/drawer'
import DrawerMenu from 'screens/DrawerMenu'
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
