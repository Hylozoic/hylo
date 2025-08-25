import React from 'react'
import { TouchableOpacity } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import { SquarePen } from 'lucide-react-native'
import useLinkingStore from 'navigation/linking/store'
import ModalHeader from 'navigation/headers/ModalHeader'
import NewMessage from 'screens/NewMessage'
import Thread from 'screens/Thread'
import ThreadList from 'screens/ThreadList'
import Colors from '../style/theme-colors'

const Messages = createStackNavigator()
export default function MessagesNavigator () {
  const { initialURL } = useLinkingStore()
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
      headerStyle: { backgroundColor: Colors.background20 },
      headerTitleStyle: { color: Colors.foreground }
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
                  <SquarePen color={Colors.selected} size={28} />
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
