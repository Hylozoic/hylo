import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
// Helper Components
import ModalHeader from 'navigation/headers/ModalHeader'
// Screens
import NewMessage from 'screens/NewMessage'
import Thread from 'screens/Thread'
import ThreadList from 'screens/ThreadList'
import { alabaster, rhino } from 'style/colors'
import { useSelector } from 'react-redux'

const Messages = createStackNavigator()
export default function MessagesNavigator () {
  const initialURL = useSelector(state => state.initialURL)
  const navigatorProps = {
    initialRouteName: 'Messages',
    screenOptions: {
      animationEnabled: !initialURL,
      transitionSpec: {
        open: {
          animation: 'spring',
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01
        },
        close: {
          animation: 'spring',
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01
        }
      },
      headerStyle: { backgroundColor: rhino },
      headerTitleStyle: { color: alabaster } // flag-messages-background-color
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
              // For a more custom "New Message" button:
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
            />
          )
        }}
      />
    </Messages.Navigator>
  )
}
