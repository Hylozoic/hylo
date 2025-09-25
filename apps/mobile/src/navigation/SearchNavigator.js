import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import ModalHeader from 'navigation/headers/ModalHeader'
import SearchPage from 'screens/SearchPage'
import { alabaster, black10OnCaribbeanGreen } from '@hylo/presenters/colors'

const Search = createStackNavigator()
export default function SearchNavigator () {
  const navigatorProps = {
    screenOptions: {
      headerStyle: { backgroundColor: black10OnCaribbeanGreen },
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
