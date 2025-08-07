import React, { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useAuth } from '@hylo/contexts/AuthContext'
import useOpenInitialURL from '../hooks/useOpenInitialURL'
import ModalHeader from './headers/ModalHeader'
import Login from '../screens/Login'
import ForgotPassword from '../screens/ForgotPassword'
import SignupNavigator from './SignupNavigator'
import { white } from '@hylo/presenters/colors'

const NonAuthRoot = createStackNavigator()
export default function NonAuthRootNavigator () {
  const navigation = useNavigation()
  const { isAuthenticated, fetching } = useAuth()

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