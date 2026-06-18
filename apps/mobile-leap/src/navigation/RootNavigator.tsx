import { useEffect, useRef } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '@hylo/contexts/AuthContext'
import customLinking, {
  AUTH_ROOT_SCREEN_NAME,
  NON_AUTH_ROOT_SCREEN_NAME
} from './linking'
import { navigationRef } from './linking/helpers'
import AuthNavigator from './AuthNavigator'
import NonAuthNavigator from './NonAuthNavigator'
import ModalHeader from './headers/ModalHeader'
import LoginByTokenHandlerScreen from '../screens/LoginByTokenHandler/LoginByTokenHandlerScreen'
import JoinGroupScreen from '../screens/JoinGroup/JoinGroupScreen'
import UnknownScreen from '../screens/Unknown/UnknownScreen'

const Root = createNativeStackNavigator()

export default function RootNavigator () {
  const { isAuthorized, fetching } = useAuth()
  const hasCompletedInitialAuthFetch = useRef(false)

  useEffect(() => {
    if (!fetching) {
      hasCompletedInitialAuthFetch.current = true
    }
  }, [fetching])

  if (fetching && !hasCompletedInitialAuthFetch.current) {
    return (
      <View className='flex-1 items-center justify-center bg-background'>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <NavigationContainer
      linking={customLinking}
      ref={navigationRef}
      navigationInChildEnabled
    >
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {isAuthorized && (
          <Root.Screen
            name={AUTH_ROOT_SCREEN_NAME}
            component={AuthNavigator}
          />
        )}
        {!isAuthorized && (
          <Root.Screen
            name={NON_AUTH_ROOT_SCREEN_NAME}
            component={NonAuthNavigator}
          />
        )}
        <Root.Screen
          name='LoginByTokenHandler'
          component={LoginByTokenHandlerScreen}
          options={{ animation: 'none' }}
        />
        <Root.Group screenOptions={{ presentation: 'modal', header: ModalHeader }}>
          <Root.Screen
            name='JoinGroup'
            component={JoinGroupScreen}
            options={{ title: 'Joining Group...' }}
          />
          {__DEV__ && (
            <Root.Screen name='Unknown' component={UnknownScreen} />
          )}
        </Root.Group>
      </Root.Navigator>
    </NavigationContainer>
  )
}
