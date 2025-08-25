import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import ModalHeader from 'navigation/headers/ModalHeader'
import SearchPage from 'screens/SearchPage'
import { useColorScheme } from 'react-native'
import { useCurrentGroup } from '@hylo/hooks/useCurrentGroup'
import Colors from '../style/theme-colors'

const Search = createStackNavigator()
export default function SearchNavigator () {
  const navigatorProps = {
    screenOptions: {
      headerStyle: { backgroundColor: Colors.selected10 },
      headerTitleStyle: { color: Colors.muted },
      header: headerProps => (
        <ModalHeader
          {...headerProps}
          // Hides "X button
          headerLeft={() => {}}
        />
      )

    }
  }

  return (
    <Search.Navigator {...navigatorProps}>
      <Search.Screen
        name='Search'
        component={SearchPage}
      />
    </Search.Navigator>
  )
}
