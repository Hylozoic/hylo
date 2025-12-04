// DEPRECATED: This navigator is no longer used.
// All navigation is now handled by the web app displayed in PrimaryWebView.
// Search functionality and screens have been replaced.
// Kept for reference only.
// Last used: 2025-01-28

/*
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
*/

// No-op export - navigator is deprecated
export default function SearchNavigator () {
  return null
}
