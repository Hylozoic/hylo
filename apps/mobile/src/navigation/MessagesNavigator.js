import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import { createStackNavigator } from '@react-navigation/stack'
import { SquarePen } from 'lucide-react-native'
import ModalHeader from 'navigation/headers/ModalHeader'
import NewMessage from 'screens/NewMessage'
import Thread from 'screens/Thread'
import ThreadList from 'screens/ThreadList'
import { alabaster, caribbeanGreen, rhino } from 'style/colors'

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
      headerStyle: { backgroundColor: alabaster },
      headerTitleStyle: { color: rhino }
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
              headerRight={() => (
                <TouchableOpacity
                  style={{ marginRight: 20 }}
                  onPress={() => headerProps.navigation.navigate('New Message')}
                >
                  <SquarePen color={caribbeanGreen} size={28} />
                </TouchableOpacity>
              )}
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
