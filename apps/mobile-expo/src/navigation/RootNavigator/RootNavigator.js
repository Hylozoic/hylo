import React from 'react'
import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useAuth } from '@hylo/contexts/AuthContext'
import AuthRootNavigator from '../AuthRootNavigator'
import NonAuthRootNavigator from '../NonAuthRootNavigator'
import ModalHeader from '../headers/ModalHeader'
import JoinGroup from '../../screens/JoinGroup'
import LoginByTokenHandler from '../../screens/LoginByTokenHandler'
import Unknown from '../../screens/Unknown'
import { customLinking } from '../linking'
import { navigationRef } from '../linking'
import { isProduction } from 'config'
import { white } from '@hylo/presenters/colors'

const AUTH_ROOT_SCREEN_NAME = 'AuthRoot'
const NON_AUTH_ROOT_SCREEN_NAME = 'NonAuthRoot'

const Root = createStackNavigator()
export default function RootNavigator () {
  // Here and `JoinGroup` should be the only place we check for a session from the API.
  // Routes will not be available until this check is complete.
  const { isAuthorized, fetching } = useAuth()

  if (fetching) return null

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
          // RNBootSplash.hide({ fade: true })
        }}
        // To get a map of the current navigation state:
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