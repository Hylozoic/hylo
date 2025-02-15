import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import Intercom from '@intercom/intercom-react-native'
import mixpanel from 'services/mixpanel'
import { OneSignal } from 'react-native-onesignal'
import { clearSessionCookie } from 'util/session'
import { useAuth } from '@hylo/contexts/AuthContext'

export const logoutServices = async () => {
  try {
    await clearSessionCookie()

    OneSignal.logout()
    Intercom.logout()
    mixpanel.flush()
    mixpanel.reset()

    if (await GoogleSignin.isSignedIn()) {
      await GoogleSignin.signOut()
    }
  } catch (error) {
    console.error('Error during logout:', error.message)
  }
}

export const useLogout = () => {
  const navigation = useNavigation()
  const { logout } = useAuth()
  const logoutRedirect = useCallback(async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Loading' }]
      })
      await logout()
      await logoutServices()
    } catch (error) {
      console.error('Error during logout:', error.message)
    }
  }, [navigation])

  return logoutRedirect
}

export default useLogout
