import { createNativeStackNavigator } from '@react-navigation/native-stack'
import useBindPlatformUser from '../hooks/useBindPlatformUser'
import useHandleLinking from '../hooks/useHandleLinking'
import PrimaryWebViewScreen from '../screens/PrimaryWebView/PrimaryWebViewScreen'

const AuthRoot = createNativeStackNavigator()

function AuthNavigatorContent () {
  useBindPlatformUser()
  useHandleLinking(false)

  return (
    <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
      <AuthRoot.Screen name='Main' component={PrimaryWebViewScreen} />
    </AuthRoot.Navigator>
  )
}

export default function AuthNavigator () {
  return <AuthNavigatorContent />
}
