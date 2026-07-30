import { createNativeStackNavigator } from '@react-navigation/native-stack'
import useBindPlatformUser from '../hooks/useBindPlatformUser'
import useHandleLinking from '../hooks/useHandleLinking'
import PrimaryWebViewScreen from '../screens/PrimaryWebView/PrimaryWebViewScreen'

const AuthRoot = createNativeStackNavigator()

// RootNavigator only mounts this when isAuthorized — no separate loading gate here
// (a parent/child split with duplicate useCurrentUser caused setState-during-render).
export default function AuthNavigator () {
  useBindPlatformUser()
  useHandleLinking(false)

  return (
    <AuthRoot.Navigator screenOptions={{ headerShown: false }}>
      <AuthRoot.Screen name='Main' component={PrimaryWebViewScreen} />
    </AuthRoot.Navigator>
  )
}
