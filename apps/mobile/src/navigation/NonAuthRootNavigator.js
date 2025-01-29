import React, { useEffect } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import useOpenInitialURL from 'hooks/useOpenInitialURL'
import ModalHeader from 'navigation/headers/ModalHeader'
import Login from 'screens/Login'
import ForgotPassword from 'screens/ForgotPassword'
import SignupNavigator from 'navigation/SignupNavigator'
import { useNavigation } from '@react-navigation/native'
import { white } from 'style/colors'
import useAuthStatus from 'urql-shared/hooks/useAuthStatus'

const NonAuthRoot = createStackNavigator()
export default function NonAuthRootNavigator () {
  const navigation = useNavigation()
  const [{ isAuthenticated, fetching }] = useAuthStatus()

  // If user authenticated we know they are not authorized also
  // as authorization is handled by `RootNavigator`.
  // This redirection is for the purpose of sending the user
  // to `Signup` where additional redirection happens according
  // to their "authState".
  useEffect(() => {
    if (!fetching && isAuthenticated) navigation.navigate('Signup')
  }, [isAuthenticated])

  useOpenInitialURL()

  const navigatorProps = {
    screenOptions: {
      cardStyle: { backgroundColor: white },
      headerShown: false,
      header: headerProps => <ModalHeader {...headerProps} />
    }
  }

  return (
    <NonAuthRoot.Navigator {...navigatorProps}>
      <NonAuthRoot.Screen
        name='Login'
        component={Login}
        options={{
          animationEnabled: false
        }}
      />
      <NonAuthRoot.Screen
        name='ForgotPassword'
        component={ForgotPassword}
        options={{
          headerShown: true,
          title: 'Reset Your Password'
        }}
      />
      <NonAuthRoot.Screen
        name='Signup'
        component={SignupNavigator}
        options={{
          animationEnabled: false
        }}
      />
    </NonAuthRoot.Navigator>
  )
}
