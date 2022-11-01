import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
// Helper Components
import { ModalHeader } from 'navigation/headers'
// Screens
import NewMessage from 'screens/NewMessage'
import Thread from 'screens/Thread'
import ThreadList from 'screens/ThreadList'
import { rhino, rhino10 } from 'style/colors'
// import Icon from 'components/Icon'
// import { TouchableOpacity } from 'react-native-gesture-handler'

const Messages = createStackNavigator()
export default function MessagesNavigator () {
  const navigatorProps = {
    screenOptions: {
      headerStyle: { backgroundColor: rhino },
      headerTitleStyle: { color: rhino10 }
    }
  }

  return (
    <Messages.Navigator {...navigatorProps}>
      <Messages.Screen
        name='Messages'
        component={ThreadList}
        options={{
          header: headerProps => (
            <ModalHeader
              {...headerProps}
              headerLeft={() => {}}
              // headerRight={() => <TouchableOpacity style={{ marginRight: 20 }} onPress={() => headerProps.navigation.navigate('New Message')}><Icon size={22} color={rhino05} name='Plus' /></TouchableOpacity>}
              headerRightButtonLabel='New'
              headerRightButtonOnPress={() => headerProps.navigation.navigate('New Message')}
            />
          )
        }}
      />
      <Messages.Screen
        name='New Message'
        component={NewMessage}
        options={{
          header: headerProps => (
            <ModalHeader
              {...headerProps}
              headerLeftCloseIcon={false}
            />
          )
        }}
      />
      <Messages.Screen
        name='Thread'
        component={Thread}
        options={{
          header: headerProps => (
            <ModalHeader
              {...headerProps}
              headerLeftCloseIcon={false}
              headerLeftOnPress={() => headerProps.navigation.navigate('Messages')}
            />
          )
        }}
      />
    </Messages.Navigator>
  )
}
