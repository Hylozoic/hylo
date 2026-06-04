import { useCallback } from 'react'
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

// After logout(), AuthContext.checkAuth() sets isAuthorized=false and RootNavigator
// swaps NonAuthRoot for AuthRoot — no stack reset is required. A previous reset to a
// non-existent "Loading" route caused: "The action 'RESET' ... was not handled".
export const useLogout = () => {
  const { logout } = useAuth()
  const logoutRedirect = useCallback(async () => {
    try {
      await logout()
      await logoutServices()
    } catch (error) {
      console.error('Error during logout:', error.message)
    }
  }, [logout])

  return logoutRedirect
}

export default useLogout
