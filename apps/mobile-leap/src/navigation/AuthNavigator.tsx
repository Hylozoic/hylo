import { createNativeStackNavigator } from '@react-navigation/native-stack'
import useBindPlatformUser from '../hooks/useBindPlatformUser'
import useOpenInitialURL from '../hooks/useOpenInitialURL'
import PrimaryWebViewScreen from '../screens/PrimaryWebView/PrimaryWebViewScreen'

const AuthRoot = createNativeStackNavigator()

function AuthNavigatorContent () {
  useBindPlatformUser()
  useOpenInitialURL(false)

  return (
    <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
      <AuthRoot.Screen name='Main' component={PrimaryWebViewScreen} />
    </AuthRoot.Navigator>
  )
}

export default function AuthNavigator () {
  return <AuthNavigatorContent />
}
