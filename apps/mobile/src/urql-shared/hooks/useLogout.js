import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from 'urql'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import Intercom from '@intercom/intercom-react-native'
import apiHost from 'util/apiHost'
import { clearSessionCookie } from 'util/session'
import logoutMutation from 'graphql/mutations/logoutMutation'

export const logout = async () => {
  try {
    await fetch(apiHost + '/noo/session', { method: 'DELETE' })
    await clearSessionCookie()

    Intercom.logout()

    if (await GoogleSignin.isSignedIn()) {
      await GoogleSignin.signOut()
    }
  } catch (error) {
    console.error('Error during logout:', error.message)
  }
}

export const useLogout = () => {
  const navigation = useNavigation()
  const [, logout] = useMutation(logoutMutation)
  const logoutRedirect = useCallback(async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Loading' }]
      })
      await logout()
    } catch (error) {
      console.error('Error during logout:', error.message)
    }
  }, [navigation])

  return logoutRedirect
}

export default useLogout
