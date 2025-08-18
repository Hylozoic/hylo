import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import ModalHeader from 'navigation/headers/ModalHeader'
import SearchPage from 'screens/SearchPage'
import { alabaster } from '@hylo/presenters/colors'
import Colors from '../style/theme-colors'

const Search = createStackNavigator()
export default function SearchNavigator () {
  const navigatorProps = {
    screenOptions: {
      headerStyle: { backgroundColor: Colors.selected10 },
      headerTitleStyle: { color: alabaster },
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
