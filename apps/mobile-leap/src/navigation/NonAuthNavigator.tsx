import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hylo/contexts/AuthContext'
import useOpenInitialURL from '../hooks/useOpenInitialURL'
import ModalHeader from './headers/ModalHeader'
import LoginScreen from '../screens/Login/LoginScreen'
import ForgotPasswordScreen from '../screens/ForgotPassword/ForgotPasswordScreen'
import SignupNavigator from './SignupNavigator'

const NonAuthRoot = createNativeStackNavigator()

export default function NonAuthNavigator () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { isAuthenticated, fetching } = useAuth()

  useEffect(() => {
    if (!fetching && isAuthenticated) navigation.navigate('Signup' as never)
  }, [isAuthenticated, fetching, navigation])

  useOpenInitialURL(fetching)

  return (
    <NonAuthRoot.Navigator
      screenOptions={{
        headerShown: false,
        header: ModalHeader
      }}
    >
      <NonAuthRoot.Screen
        name='Login'
        component={LoginScreen}
        options={{ animation: 'none' }}
      />
      <NonAuthRoot.Screen
        name='ForgotPassword'
        component={ForgotPasswordScreen}
        options={{
          headerShown: true,
          title: t('Reset Your Password')
        }}
      />
      <NonAuthRoot.Screen
        name='Signup'
        component={SignupNavigator}
        options={{ animation: 'none' }}
      />
    </NonAuthRoot.Navigator>
  )
}
