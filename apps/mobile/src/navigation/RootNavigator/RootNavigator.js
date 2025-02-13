import React, { useEffect } from 'react'
import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationRef } from 'navigation/linking/helpers'
import { OneSignal } from 'react-native-onesignal'
import RNBootSplash from 'react-native-bootsplash'
import customLinking, {
  AUTH_ROOT_SCREEN_NAME,
  NON_AUTH_ROOT_SCREEN_NAME
} from 'navigation/linking'
import { useAuth } from '@hylo/contexts/AuthContext'
import { isProduction } from 'config'
import { openURL } from 'hooks/useOpenURL'
import ModalHeader from 'navigation/headers/ModalHeader'
import JoinGroup from 'screens/JoinGroup'
import LoginByTokenHandler from 'screens/LoginByTokenHandler'
import AuthRootNavigator from 'navigation/AuthRootNavigator'
import NonAuthRootNavigator from 'navigation/NonAuthRootNavigator'
import LoadingScreen from 'screens/LoadingScreen'
import Unknown from 'screens/Unknown'
import { white } from 'style/colors'

const Root = createStackNavigator()
export default function RootNavigator () {
  // Here and `JoinGroup` should be the only place we check for a session from the API.
  // Routes will not be available until this check is complete.
  const { isAuthorized, fetching } = useAuth()

  // Handle Push Notifications opened
  useEffect(() => {
    const notificationClickHandler = ({ notification }) => {
      const path = notification?.additionalData?.path
      if (path) {
        openURL(path)
      }
    }
    OneSignal.Notifications.addEventListener('click', notificationClickHandler)

    return () => {
      OneSignal.Notifications.removeEventListener('click', notificationClickHandler)
    }
  }, [])

  if (fetching) return <LoadingScreen />

  const navigatorProps = {
    screenOptions: {
      cardStyle: { backgroundColor: white }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        linking={customLinking}
        ref={navigationRef}
        onReady={() => {
          RNBootSplash.hide({ fade: true })
        }}
        // To get a map of the current navigation state:
        // onStateChange={state => console.log('!!! onStateChange:', JSON.stringify(state.routes, null, 2))}
      >
        <Root.Navigator {...navigatorProps}>
          {isAuthorized && (
            <Root.Screen name={AUTH_ROOT_SCREEN_NAME} component={AuthRootNavigator} options={{ headerShown: false }} />
          )}
          {!isAuthorized && (
            <Root.Screen name={NON_AUTH_ROOT_SCREEN_NAME} component={NonAuthRootNavigator} options={{ headerShown: false }} />
          )}
          {/* Screens always available */}
          <Root.Screen
            name='LoginByTokenHandler'
            options={{ headerShown: false, animationEnabled: false }}
            component={LoginByTokenHandler}
          />
          <Root.Group screenOptions={{ presentation: 'modal', header: ModalHeader }}>
            <Root.Screen name='JoinGroup' component={JoinGroup} options={{ title: 'Joining Group...' }} />
            {!isProduction && (
              <Root.Screen name='Unknown' component={Unknown} />
            )}
          </Root.Group>
        </Root.Navigator>
      </NavigationContainer>
    </View>
  )
}
